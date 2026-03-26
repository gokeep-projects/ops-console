package web

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"html/template"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"ops-tool/internal/backup"
	"ops-tool/internal/config"
	"ops-tool/internal/logs"
	"ops-tool/internal/monitor"
	"ops-tool/internal/script"
	"ops-tool/internal/store"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

type Server struct {
	baseDir    string
	configPath string
	store      *store.Store

	mu     sync.RWMutex
	cfg    *config.Config
	tpl    *template.Template
	router *chi.Mux

	runner *script.Runner
	backup *backup.Manager

	httpServer *http.Server

	trendMu       sync.Mutex
	trendFlushMu  sync.Mutex
	trendBuffer   []store.MonitorTrendSample
	trendStopChan chan struct{}
	trendStopOnce sync.Once
}

const (
	trendFlushInterval   = 30 * time.Second
	trendFlushTriggerLen = 12
	trendBufferMax       = 4096
)

func NewServer(baseDir, configPath string, cfg *config.Config, st *store.Store) (*Server, error) {
	tplPath := filepath.Join(baseDir, "web", "templates", "index.html")
	tpl, err := template.ParseFiles(tplPath)
	if err != nil {
		return nil, err
	}

	s := &Server{
		baseDir:     baseDir,
		configPath:  configPath,
		cfg:         cfg,
		store:       st,
		tpl:         tpl,
		runner:      script.NewRunner(st),
		backup:      backup.NewManager(st),
		trendBuffer: make([]store.MonitorTrendSample, 0, 256),
	}
	s.router = s.routes()
	return s, nil
}

func (s *Server) Start(addr string) error {
	s.httpServer = &http.Server{
		Addr:    addr,
		Handler: s.router,
	}
	s.startTrendFlusher()
	err := s.httpServer.ListenAndServe()
	if errors.Is(err, http.ErrServerClosed) {
		return nil
	}
	return err
}

func (s *Server) Shutdown(ctx context.Context) error {
	s.stopTrendFlusher()
	flushErr := s.flushTrendBuffer()
	if s.httpServer == nil {
		return flushErr
	}
	if err := s.httpServer.Shutdown(ctx); err != nil {
		if flushErr != nil {
			return fmt.Errorf("shutdown error: %v; trend flush error: %w", err, flushErr)
		}
		return err
	}
	return flushErr
}

func (s *Server) routes() *chi.Mux {
	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Logger)

	staticDir := filepath.Join(s.baseDir, "web", "static")
	r.Handle("/static/*", http.StripPrefix("/static/", http.FileServer(http.Dir(staticDir))))

	r.Get("/", s.handleIndex)
	r.Get("/api/config", s.handleGetConfig)
	r.Put("/api/config", s.handleUpdateConfig)

	r.Get("/api/monitor", s.handleMonitor)
	r.Get("/api/monitor/trends", s.handleMonitorTrends)
	r.Get("/api/processes/{pid}/detail", s.handleProcessDetail)
	r.Post("/api/processes/{pid}/kill", s.handleProcessKill)

	r.Get("/api/logs/apps", s.handleLogApps)
	r.Get("/api/logs/{app}", s.handleLogSearch)
	r.Post("/api/logs/{app}/export", s.handleLogExport)

	r.Get("/api/scripts", s.handleScripts)
	r.Post("/api/scripts/upload", s.handleScriptUpload)
	r.Post("/api/scripts/run", s.handleScriptRun)
	r.Get("/api/scripts/runs", s.handleScriptRuns)
	r.Get("/api/scripts/runs/{id}", s.handleScriptRunDetail)

	r.Get("/api/backups", s.handleBackups)
	r.Post("/api/backups/run", s.handleBackupRun)
	r.Get("/api/backups/download", s.handleBackupDownload)
	return r
}

func (s *Server) handleIndex(w http.ResponseWriter, r *http.Request) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	data := map[string]any{
		"Title":  "运维工具",
		"Config": s.cfg,
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	if err := s.tpl.Execute(w, data); err != nil {
		writeErr(w, http.StatusInternalServerError, err)
	}
}

func (s *Server) handleGetConfig(w http.ResponseWriter, r *http.Request) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	writeJSON(w, http.StatusOK, s.cfg)
}

func (s *Server) handleUpdateConfig(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}

	var incoming config.Config
	if err := json.Unmarshal(body, &incoming); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	incoming.Applications = s.cfg.Applications
	s.cfg = &incoming

	if err := config.Save(s.configPath, s.cfg); err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	if err := s.store.SyncConfig(s.cfg); err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) handleMonitor(w http.ResponseWriter, r *http.Request) {
	s.mu.RLock()
	cfg := *s.cfg
	s.mu.RUnlock()
	res := monitor.Gather(&cfg)
	s.appendTrendSample(buildMonitorTrendSample(res))
	if s.trendBufferLen() >= trendFlushTriggerLen {
		if err := s.flushTrendBuffer(); err != nil {
			log.Printf("flush trend buffer failed: %v", err)
		}
	}
	writeJSON(w, http.StatusOK, res)
}

func (s *Server) handleMonitorTrends(w http.ResponseWriter, r *http.Request) {
	hours, _ := strconv.Atoi(strings.TrimSpace(r.URL.Query().Get("hours")))
	if hours <= 0 {
		hours = 24
	}
	if hours > 24 {
		hours = 24
	}
	since := time.Now().Add(-time.Duration(hours) * time.Hour)
	items, err := s.store.ListMonitorTrends(since)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}

	type point struct {
		TS    int64   `json:"ts"`
		Value float64 `json:"value"`
	}
	series := map[string][]point{
		"cpu":     make([]point, 0, len(items)),
		"memory":  make([]point, 0, len(items)),
		"network": make([]point, 0, len(items)),
		"process": make([]point, 0, len(items)),
		"diskio":  make([]point, 0, len(items)),
	}
	for _, item := range items {
		ts := item.At.UnixMilli()
		series["cpu"] = append(series["cpu"], point{TS: ts, Value: item.CPUUsage})
		series["memory"] = append(series["memory"], point{TS: ts, Value: item.MemoryUsage})
		series["network"] = append(series["network"], point{TS: ts, Value: item.NetworkRate})
		series["process"] = append(series["process"], point{TS: ts, Value: item.ProcessCount})
		series["diskio"] = append(series["diskio"], point{TS: ts, Value: item.DiskIORate})
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"hours":  hours,
		"series": series,
	})
}

func (s *Server) handleProcessDetail(w http.ResponseWriter, r *http.Request) {
	pid, err := strconv.ParseInt(chi.URLParam(r, "pid"), 10, 32)
	if err != nil {
		writeErr(w, http.StatusBadRequest, fmt.Errorf("invalid pid"))
		return
	}
	item, err := monitor.GetProcessDetail(int32(pid))
	if err != nil {
		writeErr(w, http.StatusNotFound, err)
		return
	}
	writeJSON(w, http.StatusOK, item)
}

func (s *Server) handleProcessKill(w http.ResponseWriter, r *http.Request) {
	pid, err := strconv.ParseInt(chi.URLParam(r, "pid"), 10, 32)
	if err != nil {
		writeErr(w, http.StatusBadRequest, fmt.Errorf("invalid pid"))
		return
	}
	if err := monitor.KillProcess(int32(pid)); err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":  true,
		"pid": pid,
	})
}

func (s *Server) handleLogApps(w http.ResponseWriter, r *http.Request) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	type appResp struct {
		Name     string   `json:"name"`
		Type     string   `json:"type"`
		Enabled  bool     `json:"enabled"`
		LogFiles []string `json:"log_files"`
	}
	out := make([]appResp, 0, len(s.cfg.Applications))
	for _, app := range s.cfg.Applications {
		app.LogFiles = s.resolvePaths(app.LogFiles)
		out = append(out, appResp{
			Name:     app.Name,
			Type:     app.Type,
			Enabled:  app.Enabled,
			LogFiles: app.LogFiles,
		})
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"apps":  out,
		"rules": s.cfg.LogAnalysis.Rules,
	})
}

func (s *Server) handleLogSearch(w http.ResponseWriter, r *http.Request) {
	appName := chi.URLParam(r, "app")

	s.mu.RLock()
	app, ok := s.cfg.FindApp(appName)
	rules := s.cfg.LogAnalysis.Rules
	maxLines := s.cfg.LogAnalysis.MaxLines
	s.mu.RUnlock()
	if !ok {
		writeErr(w, http.StatusNotFound, fmt.Errorf("app not found: %s", appName))
		return
	}
	app.LogFiles = s.resolvePaths(app.LogFiles)

	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit <= 0 || limit > maxLines {
		limit = minInt(300, maxLines)
	}
	query := logs.Query{
		Keyword: r.URL.Query().Get("keyword"),
		Level:   r.URL.Query().Get("level"),
		Limit:   limit,
		Rule:    r.URL.Query().Get("rule"),
	}
	items, err := logs.SearchAppLogs(app, rules, query)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"app":   appName,
		"total": len(items),
		"items": items,
	})
}

func (s *Server) handleLogExport(w http.ResponseWriter, r *http.Request) {
	appName := chi.URLParam(r, "app")

	var req struct {
		Files []string `json:"files"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}

	s.mu.RLock()
	app, ok := s.cfg.FindApp(appName)
	backupDir := s.cfg.Backup.StoragePath
	s.mu.RUnlock()
	if !ok {
		writeErr(w, http.StatusNotFound, fmt.Errorf("app not found: %s", appName))
		return
	}
	app.LogFiles = s.resolvePaths(app.LogFiles)
	req.Files = s.resolvePaths(req.Files)
	backupDir = s.resolvePath(backupDir)

	if err := os.MkdirAll(backupDir, 0o755); err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	out := filepath.Join(backupDir, fmt.Sprintf("log_export_%s_%s.zip", appName, time.Now().Format("20060102_150405")))
	if _, err := logs.ExportAppLogs(app, req.Files, out); err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"path":         out,
		"download_url": "/api/backups/download?path=" + out,
	})
}

func (s *Server) handleScripts(w http.ResponseWriter, r *http.Request) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	type scriptResp struct {
		Name        string   `json:"name"`
		Path        string   `json:"path"`
		Shell       string   `json:"shell"`
		Description string   `json:"description"`
		Parameters  []string `json:"parameters"`
		Enabled     bool     `json:"enabled"`
	}
	out := make([]scriptResp, 0, len(s.cfg.Repair.Scripts))
	for _, item := range s.cfg.Repair.Scripts {
		item.Path = s.resolvePath(item.Path)
		out = append(out, scriptResp{
			Name:        item.Name,
			Path:        item.Path,
			Shell:       item.Shell,
			Description: item.Description,
			Parameters:  item.Parameters,
			Enabled:     item.Enabled,
		})
	}
	writeJSON(w, http.StatusOK, map[string]any{"scripts": out})
}

func (s *Server) handleScriptUpload(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseMultipartForm(32 << 20); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	file, fh, err := r.FormFile("file")
	if err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	defer file.Close()

	name := strings.TrimSpace(r.FormValue("name"))
	if name == "" {
		name = strings.TrimSuffix(fh.Filename, filepath.Ext(fh.Filename))
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	scriptRoot := s.resolvePath(s.cfg.Repair.ScriptRoot)
	if err := os.MkdirAll(scriptRoot, 0o755); err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	dstPath := filepath.Join(scriptRoot, fh.Filename)
	dst, err := os.Create(dstPath)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	defer dst.Close()
	if _, err := io.Copy(dst, file); err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}

	item := config.RepairScript{
		Name:        name,
		Path:        dstPath,
		Shell:       strings.TrimSpace(r.FormValue("shell")),
		Description: strings.TrimSpace(r.FormValue("description")),
		Parameters:  splitCSV(r.FormValue("parameters")),
		Enabled:     true,
	}
	s.cfg.Repair.Scripts = append(s.cfg.Repair.Scripts, item)

	if err := config.Save(s.configPath, s.cfg); err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	if err := s.store.SyncConfig(s.cfg); err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) handleScriptRun(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name string `json:"name"`
		Args string `json:"args"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}

	s.mu.RLock()
	var scriptItem *config.RepairScript
	for _, sc := range s.cfg.Repair.Scripts {
		if sc.Name == req.Name {
			c := sc
			c.Path = s.resolvePath(c.Path)
			scriptItem = &c
			break
		}
	}
	s.mu.RUnlock()

	if scriptItem == nil {
		writeErr(w, http.StatusNotFound, errors.New("script not found"))
		return
	}

	runID, err := s.runner.Run(*scriptItem, splitArgs(req.Args))
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"run_id": runID})
}

func (s *Server) handleScriptRuns(w http.ResponseWriter, r *http.Request) {
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	items, err := s.store.ListScriptRuns(limit)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (s *Server) handleScriptRunDetail(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	item, err := s.store.GetScriptRun(id)
	if err != nil {
		writeErr(w, http.StatusNotFound, err)
		return
	}
	writeJSON(w, http.StatusOK, item)
}

func (s *Server) handleBackups(w http.ResponseWriter, r *http.Request) {
	items, err := s.store.ListBackups(200)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	s.mu.RLock()
	cfg := s.cfg.Backup
	s.mu.RUnlock()
	writeJSON(w, http.StatusOK, map[string]any{
		"items":  items,
		"config": cfg,
	})
}

func (s *Server) handleBackupRun(w http.ResponseWriter, r *http.Request) {
	var req backup.Request
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	s.mu.Lock()
	cfg := *s.cfg
	if req.Target != "" {
		cfg.Backup.StoragePath = req.Target
		s.cfg.Backup.StoragePath = req.Target
		if err := config.Save(s.configPath, s.cfg); err == nil {
			_ = s.store.SyncConfig(s.cfg)
		}
	}
	s.mu.Unlock()

	id, path, err := s.backup.Start(&cfg, req)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"id":   id,
		"path": path,
	})
}

func (s *Server) handleBackupDownload(w http.ResponseWriter, r *http.Request) {
	p := r.URL.Query().Get("path")
	if p == "" {
		writeErr(w, http.StatusBadRequest, errors.New("path is required"))
		return
	}
	resolved := s.resolvePath(p)
	if _, err := os.Stat(resolved); err != nil {
		writeErr(w, http.StatusNotFound, err)
		return
	}
	w.Header().Set("Content-Disposition", "attachment; filename="+filepath.Base(resolved))
	http.ServeFile(w, r, resolved)
}

func (s *Server) resolvePath(p string) string {
	if p == "" {
		return p
	}
	if filepath.IsAbs(p) {
		return p
	}
	return filepath.Join(s.baseDir, p)
}

func (s *Server) resolvePaths(paths []string) []string {
	if len(paths) == 0 {
		return paths
	}
	out := make([]string, 0, len(paths))
	for _, p := range paths {
		out = append(out, s.resolvePath(p))
	}
	return out
}

func buildMonitorTrendSample(snapshot monitor.Snapshot) store.MonitorTrendSample {
	diskTotal := snapshot.DiskIO.ReadBytes + snapshot.DiskIO.WriteBytes
	if diskTotal == 0 {
		for _, d := range snapshot.Disks {
			diskTotal += d.ReadBytes
			diskTotal += d.WriteBytes
		}
	}
	return store.MonitorTrendSample{
		At:           snapshot.Time,
		CPUUsage:     snapshot.CPU.UsagePercent,
		MemoryUsage:  snapshot.Memory.UsedPercent,
		ProcessCount: float64(snapshot.ProcessCount),
		NetInTotal:   snapshot.Network.BytesRecv,
		NetOutTotal:  snapshot.Network.BytesSent,
		DiskTotal:    diskTotal,
	}
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}

func writeErr(w http.ResponseWriter, code int, err error) {
	writeJSON(w, code, map[string]any{
		"error": err.Error(),
	})
}

func splitCSV(raw string) []string {
	if strings.TrimSpace(raw) == "" {
		return nil
	}
	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}

func splitArgs(raw string) []string {
	return strings.Fields(strings.TrimSpace(raw))
}

func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func (s *Server) startTrendFlusher() {
	s.trendStopChan = make(chan struct{})
	go func() {
		ticker := time.NewTicker(trendFlushInterval)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				if err := s.flushTrendBuffer(); err != nil {
					log.Printf("periodic trend flush failed: %v", err)
				}
			case <-s.trendStopChan:
				return
			}
		}
	}()
}

func (s *Server) stopTrendFlusher() {
	s.trendStopOnce.Do(func() {
		if s.trendStopChan != nil {
			close(s.trendStopChan)
		}
	})
}

func (s *Server) appendTrendSample(sample store.MonitorTrendSample) {
	s.trendMu.Lock()
	defer s.trendMu.Unlock()

	if sample.At.IsZero() {
		sample.At = time.Now()
	}
	sample.At = sample.At.Truncate(5 * time.Second)

	n := len(s.trendBuffer)
	if n > 0 && s.trendBuffer[n-1].At.Equal(sample.At) {
		s.trendBuffer[n-1] = sample
		return
	}
	s.trendBuffer = append(s.trendBuffer, sample)
	if len(s.trendBuffer) > trendBufferMax {
		overflow := len(s.trendBuffer) - trendBufferMax
		s.trendBuffer = s.trendBuffer[overflow:]
	}
}

func (s *Server) trendBufferLen() int {
	s.trendMu.Lock()
	defer s.trendMu.Unlock()
	return len(s.trendBuffer)
}

func (s *Server) takeTrendBuffer() []store.MonitorTrendSample {
	s.trendMu.Lock()
	defer s.trendMu.Unlock()
	if len(s.trendBuffer) == 0 {
		return nil
	}
	out := make([]store.MonitorTrendSample, len(s.trendBuffer))
	copy(out, s.trendBuffer)
	s.trendBuffer = s.trendBuffer[:0]
	return out
}

func (s *Server) prependTrendBuffer(items []store.MonitorTrendSample) {
	if len(items) == 0 {
		return
	}
	s.trendMu.Lock()
	defer s.trendMu.Unlock()
	merged := make([]store.MonitorTrendSample, 0, len(items)+len(s.trendBuffer))
	merged = append(merged, items...)
	merged = append(merged, s.trendBuffer...)
	if len(merged) > trendBufferMax {
		merged = merged[len(merged)-trendBufferMax:]
	}
	s.trendBuffer = merged
}

func (s *Server) flushTrendBuffer() error {
	s.trendFlushMu.Lock()
	defer s.trendFlushMu.Unlock()

	batch := s.takeTrendBuffer()
	if len(batch) == 0 {
		return nil
	}

	for i, sample := range batch {
		if err := s.store.UpsertMonitorTrend(sample); err != nil {
			s.prependTrendBuffer(batch[i:])
			return err
		}
	}
	return nil
}
