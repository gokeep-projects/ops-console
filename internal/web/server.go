package web

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"html/template"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"ops-tool/internal/backup"
	"ops-tool/internal/cicd"
	"ops-tool/internal/config"
	"ops-tool/internal/logs"
	"ops-tool/internal/monitor"
	"ops-tool/internal/script"
	"ops-tool/internal/store"
	"ops-tool/internal/systemlog"
	"ops-tool/internal/traffic"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/gorilla/websocket"
	"github.com/shirou/gopsutil/v3/process"
)

type Server struct {
	baseDir    string
	configPath string
	store      *store.Store

	mu     sync.RWMutex
	cfg    *config.Config
	tpl    *template.Template
	router *chi.Mux

	runner  *script.Runner
	backup  *backup.Manager
	cicd    *cicd.Manager
	traffic *traffic.Manager

	httpServer *http.Server

	trendMu       sync.Mutex
	trendFlushMu  sync.Mutex
	trendBuffer   []store.MonitorTrendSample
	trendStopChan chan struct{}
	trendStopOnce sync.Once

	monitorMu        sync.RWMutex
	monitorCollectMu sync.Mutex
	monitorSnapshot  monitor.Snapshot
	monitorReady     bool
	monitorStopChan  chan struct{}
	monitorStopOnce  sync.Once

	wsMu      sync.RWMutex
	wsClients map[*monitorWSClient]struct{}

	authMu       sync.RWMutex
	authSessions map[string]authSession
}

const (
	trendFlushInterval   = 30 * time.Second
	trendFlushTriggerLen = 12
	trendBufferMax       = 4096
	monitorMinInterval   = 2 * time.Second

	monitorWSWriteTimeout = 10 * time.Second
	monitorWSReadTimeout  = 70 * time.Second
	monitorWSPingInterval = 30 * time.Second
	monitorWSMaxReadBytes = 1024
)

var monitorWSUpgrader = websocket.Upgrader{
	ReadBufferSize:  4096,
	WriteBufferSize: 4096,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

type monitorWSClient struct {
	conn      *websocket.Conn
	send      chan []byte
	closeOnce sync.Once
}

type monitorWSMessage struct {
	Type      string           `json:"type"`
	Timestamp int64            `json:"timestamp"`
	Data      monitor.Snapshot `json:"data,omitempty"`
}

func NewServer(baseDir, configPath string, cfg *config.Config, st *store.Store) (*Server, error) {
	tplPath := filepath.Join(baseDir, "web", "templates", "index.html")
	tpl, err := template.ParseFiles(tplPath)
	if err != nil {
		return nil, err
	}

	s := &Server{
		baseDir:      baseDir,
		configPath:   configPath,
		cfg:          cfg,
		store:        st,
		tpl:          tpl,
		runner:       script.NewRunner(st),
		backup:       backup.NewManager(st),
		cicd:         cicd.NewManager(st),
		traffic:      traffic.NewManager(),
		trendBuffer:  make([]store.MonitorTrendSample, 0, 256),
		wsClients:    make(map[*monitorWSClient]struct{}),
		authSessions: make(map[string]authSession),
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
	s.startMonitorCollector()
	err := s.httpServer.ListenAndServe()
	if errors.Is(err, http.ErrServerClosed) {
		return nil
	}
	return err
}

func (s *Server) Shutdown(ctx context.Context) error {
	s.stopMonitorCollector()
	s.stopTrendFlusher()
	s.closeMonitorWSClients()
	s.traffic.Shutdown()
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
	r.Handle("/static/*", noCache(http.StripPrefix("/static/", http.FileServer(http.Dir(staticDir)))))

	r.Get("/", s.handleIndex)
	r.Route("/api/auth", func(ar chi.Router) {
		ar.Get("/status", s.handleAuthStatus)
		ar.Post("/login", s.handleAuthLogin)
		ar.Post("/logout", s.handleAuthLogout)
	})

	r.Group(func(pr chi.Router) {
		pr.Use(s.authRequiredMiddleware)

		pr.Get("/api/config", s.handleGetConfig)
		pr.Put("/api/config", s.handleUpdateConfig)

		pr.Get("/api/system/runtime-logs", s.handleRuntimeLogs)
		pr.Get("/api/system/menu", s.handleSystemMenu)

		pr.Get("/api/fs/roots", s.handleFSRoots)
		pr.Get("/api/fs/tree", s.handleFSTree)
		pr.Post("/api/fs/mkdir", s.handleFSMkdir)

		pr.Get("/api/monitor", s.handleMonitor)
		pr.Get("/api/monitor/trends", s.handleMonitorTrends)
		pr.Get("/ws/monitor", s.handleMonitorWS)
		pr.Get("/api/processes/{pid}/detail", s.handleProcessDetail)
		pr.Post("/api/processes/{pid}/kill", s.handleProcessKill)
		pr.Get("/api/apps", s.handleAppsList)
		pr.Post("/api/apps", s.handleAppsCreate)
		pr.Put("/api/apps/{name}", s.handleAppsUpdate)
		pr.Delete("/api/apps/{name}", s.handleAppsDelete)
		pr.Get("/api/apps/{name}/detail", s.handleAppsDetail)
		pr.Post("/api/apps/{name}/start", s.handleAppsStart)

		pr.Get("/api/logs/apps", s.handleLogApps)
		pr.Post("/api/logs/apps", s.handleLogAppCreate)
		pr.Delete("/api/logs/apps/{app}", s.handleLogAppDelete)
		pr.Get("/api/logs/{app}", s.handleLogSearch)
		pr.Post("/api/logs/{app}/export", s.handleLogExport)

		pr.Get("/api/docker/status", s.handleDockerStatus)
		pr.Get("/api/docker/containers", s.handleDockerContainers)
		pr.Post("/api/docker/containers/batch", s.handleDockerContainersBatchAction)
		pr.Post("/api/docker/containers/{id}/action", s.handleDockerContainerAction)
		pr.Get("/api/docker/containers/{id}/logs", s.handleDockerContainerLogs)
		pr.Get("/api/docker/containers/{id}/inspect", s.handleDockerContainerInspect)
		pr.Get("/api/docker/images", s.handleDockerImages)
		pr.Post("/api/docker/images/batch", s.handleDockerImagesBatchAction)
		pr.Get("/api/docker/images/{id}/inspect", s.handleDockerImageInspect)
		pr.Get("/api/remote/meta", s.handleRemoteMeta)
		pr.Post("/api/remote/input", s.handleRemoteDesktopInput)
		pr.Get("/ws/remote/desktop", s.handleRemoteDesktopWS)
		pr.Get("/ws/remote/ssh", s.handleRemoteSSHWS)

		pr.Get("/api/traffic", s.handleTrafficSnapshot)

		pr.Get("/api/cicd/pipelines", s.handleCICDPipelines)
		pr.Post("/api/cicd/pipelines", s.handleCICDPipelineCreate)
		pr.Put("/api/cicd/pipelines/{id}", s.handleCICDPipelineUpdate)
		pr.Delete("/api/cicd/pipelines/{id}", s.handleCICDPipelineDelete)
		pr.Post("/api/cicd/pipelines/{id}/run", s.handleCICDPipelineRun)
		pr.Get("/api/cicd/runs", s.handleCICDRuns)
		pr.Get("/api/cicd/runs/{id}", s.handleCICDRunDetail)
		pr.Post("/api/cicd/runs/{id}/stop", s.handleCICDRunStop)

		pr.Get("/api/scripts", s.handleScripts)
		pr.Post("/api/scripts/upload", s.handleScriptUpload)
		pr.Post("/api/scripts/run", s.handleScriptRun)
		pr.Get("/api/scripts/runs", s.handleScriptRuns)
		pr.Get("/api/scripts/runs/{id}", s.handleScriptRunDetail)

		pr.Get("/api/backups", s.handleBackups)
		pr.Post("/api/backups/run", s.handleBackupRun)
		pr.Get("/api/backups/download", s.handleBackupDownload)

	})
	return r
}

func (s *Server) handleIndex(w http.ResponseWriter, r *http.Request) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	data := map[string]any{
		"Title":  maxNonEmpty(s.cfg.System.SiteTitle, "运维工具"),
		"Config": s.cfg,
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store, no-cache, must-revalidate")
	w.Header().Set("Pragma", "no-cache")
	w.Header().Set("Expires", "0")
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
	config.EnsureSystemDefaults(&incoming)
	config.EnsureLogSources(&incoming)
	s.cfg = &incoming

	if err := s.persistConfigLocked(); err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	if s.cfg.System.RuntimeLogs.Enabled {
		_ = systemlog.Configure(s.resolvePath(s.cfg.System.RuntimeLogs.FilePath), s.cfg.System.RuntimeLogs.MaxEntries)
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) handleMonitor(w http.ResponseWriter, r *http.Request) {
	res, ok := s.getMonitorSnapshot()
	if !ok {
		s.collectMonitorSnapshot()
		res, ok = s.getMonitorSnapshot()
		if !ok {
			writeErr(w, http.StatusServiceUnavailable, fmt.Errorf("监控数据初始化中，请稍后重试"))
			return
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

func (s *Server) handleMonitorWS(w http.ResponseWriter, r *http.Request) {
	conn, err := monitorWSUpgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	client := &monitorWSClient{
		conn: conn,
		send: make(chan []byte, 8),
	}
	s.registerMonitorWSClient(client)

	go s.monitorWSReader(client)
	go s.monitorWSWriter(client)

	if snapshot, ok := s.getMonitorSnapshot(); ok {
		s.enqueueMonitorSnapshot(client, snapshot)
		return
	}
	s.collectMonitorSnapshot()
	if snapshot, ok := s.getMonitorSnapshot(); ok {
		s.enqueueMonitorSnapshot(client, snapshot)
	}
}

func (s *Server) registerMonitorWSClient(client *monitorWSClient) {
	s.wsMu.Lock()
	if s.wsClients == nil {
		s.wsClients = make(map[*monitorWSClient]struct{})
	}
	s.wsClients[client] = struct{}{}
	s.wsMu.Unlock()
}

func (s *Server) unregisterMonitorWSClient(client *monitorWSClient) {
	s.wsMu.Lock()
	if _, ok := s.wsClients[client]; ok {
		delete(s.wsClients, client)
		client.closeSend()
	}
	s.wsMu.Unlock()
}

func (s *Server) closeMonitorWSClients() {
	s.wsMu.Lock()
	clients := make([]*monitorWSClient, 0, len(s.wsClients))
	for client := range s.wsClients {
		clients = append(clients, client)
		delete(s.wsClients, client)
	}
	s.wsMu.Unlock()

	for _, client := range clients {
		client.closeSend()
		_ = client.conn.Close()
	}
}

func (s *Server) monitorWSReader(client *monitorWSClient) {
	defer func() {
		s.unregisterMonitorWSClient(client)
		_ = client.conn.Close()
	}()

	client.conn.SetReadLimit(monitorWSMaxReadBytes)
	_ = client.conn.SetReadDeadline(time.Now().Add(monitorWSReadTimeout))
	client.conn.SetPongHandler(func(string) error {
		return client.conn.SetReadDeadline(time.Now().Add(monitorWSReadTimeout))
	})

	for {
		if _, _, err := client.conn.ReadMessage(); err != nil {
			return
		}
	}
}

func (s *Server) monitorWSWriter(client *monitorWSClient) {
	ticker := time.NewTicker(monitorWSPingInterval)
	defer ticker.Stop()
	defer func() {
		s.unregisterMonitorWSClient(client)
		_ = client.conn.Close()
	}()

	for {
		select {
		case payload, ok := <-client.send:
			_ = client.conn.SetWriteDeadline(time.Now().Add(monitorWSWriteTimeout))
			if !ok {
				_ = client.conn.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, ""))
				return
			}
			if err := client.conn.WriteMessage(websocket.TextMessage, payload); err != nil {
				return
			}
		case <-ticker.C:
			_ = client.conn.SetWriteDeadline(time.Now().Add(monitorWSWriteTimeout))
			if err := client.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func (s *Server) enqueueMonitorSnapshot(client *monitorWSClient, snapshot monitor.Snapshot) {
	payload, err := json.Marshal(monitorWSMessage{
		Type:      "snapshot",
		Timestamp: snapshot.Time.UnixMilli(),
		Data:      snapshot,
	})
	if err != nil {
		log.Printf("marshal monitor ws snapshot failed: %v", err)
		return
	}

	select {
	case client.send <- payload:
	default:
		s.unregisterMonitorWSClient(client)
		_ = client.conn.Close()
	}
}

func (s *Server) broadcastMonitorSnapshot(snapshot monitor.Snapshot) {
	payload, err := json.Marshal(monitorWSMessage{
		Type:      "snapshot",
		Timestamp: snapshot.Time.UnixMilli(),
		Data:      snapshot,
	})
	if err != nil {
		log.Printf("marshal monitor ws snapshot failed: %v", err)
		return
	}

	s.wsMu.RLock()
	clients := make([]*monitorWSClient, 0, len(s.wsClients))
	for client := range s.wsClients {
		clients = append(clients, client)
	}
	s.wsMu.RUnlock()

	for _, client := range clients {
		select {
		case client.send <- payload:
		default:
			s.unregisterMonitorWSClient(client)
			_ = client.conn.Close()
		}
	}
}

func (c *monitorWSClient) closeSend() {
	c.closeOnce.Do(func() {
		close(c.send)
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
	s.mu.Lock()
	changed := config.EnsureLogSources(s.cfg)
	if changed {
		if err := s.persistConfigLocked(); err != nil {
			s.mu.Unlock()
			writeErr(w, http.StatusInternalServerError, err)
			return
		}
	}
	type appResp struct {
		Name        string   `json:"name"`
		Type        string   `json:"type"`
		Enabled     bool     `json:"enabled"`
		LogFiles    []string `json:"log_files"`
		Description string   `json:"description"`
	}
	out := make([]appResp, 0, len(s.cfg.LogAnalysis.Sources))
	for _, src := range s.cfg.LogAnalysis.Sources {
		files := append([]string(nil), src.LogFiles...)
		if !strings.EqualFold(src.Type, "windows-eventlog") {
			files = s.resolvePaths(files)
		}
		out = append(out, appResp{
			Name:        src.Name,
			Type:        src.Type,
			Enabled:     src.Enabled,
			LogFiles:    files,
			Description: src.Description,
		})
	}
	rules := append([]config.LogRule(nil), s.cfg.LogAnalysis.Rules...)
	s.mu.Unlock()
	writeJSON(w, http.StatusOK, map[string]any{
		"apps":  out,
		"rules": rules,
	})
}

func (s *Server) handleLogAppCreate(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name        string   `json:"name"`
		Type        string   `json:"type"`
		Description string   `json:"description"`
		LogFiles    []string `json:"log_files"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	req.Type = strings.TrimSpace(req.Type)
	req.Description = strings.TrimSpace(req.Description)
	if req.Name == "" {
		writeErr(w, http.StatusBadRequest, fmt.Errorf("name is required"))
		return
	}
	if req.Type == "" {
		req.Type = "custom-log"
	}
	cleanFiles := make([]string, 0, len(req.LogFiles))
	seen := make(map[string]struct{}, len(req.LogFiles))
	for _, item := range req.LogFiles {
		item = strings.TrimSpace(item)
		if item == "" {
			continue
		}
		key := strings.ToLower(item)
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		cleanFiles = append(cleanFiles, item)
	}
	if len(cleanFiles) == 0 {
		writeErr(w, http.StatusBadRequest, fmt.Errorf("log_files is required"))
		return
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	for _, src := range s.cfg.LogAnalysis.Sources {
		if strings.EqualFold(strings.TrimSpace(src.Name), req.Name) {
			writeErr(w, http.StatusConflict, fmt.Errorf("log source already exists: %s", req.Name))
			return
		}
	}
	s.cfg.LogAnalysis.Sources = append(s.cfg.LogAnalysis.Sources, config.LogSource{
		Name:        req.Name,
		Type:        req.Type,
		Enabled:     true,
		LogFiles:    cleanFiles,
		Description: req.Description,
	})
	if err := s.persistConfigLocked(); err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) handleLogAppDelete(w http.ResponseWriter, r *http.Request) {
	name := strings.TrimSpace(chi.URLParam(r, "app"))
	if name == "" {
		writeErr(w, http.StatusBadRequest, fmt.Errorf("name is required"))
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()

	idx := -1
	for i, src := range s.cfg.LogAnalysis.Sources {
		if strings.EqualFold(strings.TrimSpace(src.Name), name) {
			idx = i
			break
		}
	}
	if idx < 0 {
		writeErr(w, http.StatusNotFound, fmt.Errorf("log source not found: %s", name))
		return
	}
	s.cfg.LogAnalysis.Sources = append(s.cfg.LogAnalysis.Sources[:idx], s.cfg.LogAnalysis.Sources[idx+1:]...)
	if err := s.persistConfigLocked(); err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) handleLogSearch(w http.ResponseWriter, r *http.Request) {
	appName := chi.URLParam(r, "app")

	s.mu.RLock()
	src, ok := s.cfg.FindLogSource(appName)
	rules := s.cfg.LogAnalysis.Rules
	maxLines := s.cfg.LogAnalysis.MaxLines
	s.mu.RUnlock()
	if !ok {
		writeErr(w, http.StatusNotFound, fmt.Errorf("app not found: %s", appName))
		return
	}
	app := config.Application{
		Name:     src.Name,
		Type:     src.Type,
		Enabled:  src.Enabled,
		LogFiles: append([]string(nil), src.LogFiles...),
	}
	if !strings.EqualFold(src.Type, "windows-eventlog") {
		app.LogFiles = s.resolvePaths(app.LogFiles)
	}

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
	src, ok := s.cfg.FindLogSource(appName)
	backupDir := s.cfg.Backup.StoragePath
	s.mu.RUnlock()
	if !ok {
		writeErr(w, http.StatusNotFound, fmt.Errorf("app not found: %s", appName))
		return
	}
	app := config.Application{
		Name:     src.Name,
		Type:     src.Type,
		Enabled:  src.Enabled,
		LogFiles: append([]string(nil), src.LogFiles...),
	}
	if !strings.EqualFold(src.Type, "windows-eventlog") {
		app.LogFiles = s.resolvePaths(app.LogFiles)
		req.Files = s.resolvePaths(req.Files)
	}
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

	if err := s.persistConfigLocked(); err != nil {
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
		_ = s.persistConfigLocked()
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

func (s *Server) getMonitorSnapshot() (monitor.Snapshot, bool) {
	s.monitorMu.RLock()
	defer s.monitorMu.RUnlock()
	if !s.monitorReady {
		return monitor.Snapshot{}, false
	}
	return s.monitorSnapshot, true
}

func (s *Server) monitorInterval() time.Duration {
	s.mu.RLock()
	sec := s.cfg.Monitor.RefreshSeconds
	s.mu.RUnlock()
	if sec <= 0 {
		sec = 5
	}
	d := time.Duration(sec) * time.Second
	if d < monitorMinInterval {
		d = monitorMinInterval
	}
	return d
}

func (s *Server) startMonitorCollector() {
	s.monitorStopChan = make(chan struct{})
	go func() {
		s.collectMonitorSnapshot()
		for {
			timer := time.NewTimer(s.monitorInterval())
			select {
			case <-timer.C:
				s.collectMonitorSnapshot()
			case <-s.monitorStopChan:
				if !timer.Stop() {
					select {
					case <-timer.C:
					default:
					}
				}
				return
			}
		}
	}()
}

func (s *Server) stopMonitorCollector() {
	s.monitorStopOnce.Do(func() {
		if s.monitorStopChan != nil {
			close(s.monitorStopChan)
		}
	})
}

func (s *Server) collectMonitorSnapshot() {
	s.monitorCollectMu.Lock()
	defer s.monitorCollectMu.Unlock()

	s.mu.RLock()
	cfg := *s.cfg
	s.mu.RUnlock()

	snapshot := monitor.Gather(&cfg)
	if snapshot.Time.IsZero() {
		snapshot.Time = time.Now()
	}

	s.monitorMu.Lock()
	s.monitorSnapshot = snapshot
	s.monitorReady = true
	s.monitorMu.Unlock()

	s.broadcastMonitorSnapshot(snapshot)
	s.appendTrendSample(buildMonitorTrendSample(snapshot))
	if s.trendBufferLen() >= trendFlushTriggerLen {
		if err := s.flushTrendBuffer(); err != nil {
			log.Printf("flush trend buffer failed: %v", err)
		}
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

func noCache(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store, no-cache, must-revalidate")
		w.Header().Set("Pragma", "no-cache")
		w.Header().Set("Expires", "0")
		next.ServeHTTP(w, r)
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

func maxNonEmpty(values ...string) string {
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value != "" {
			return value
		}
	}
	return ""
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

type appUpsertRequest struct {
	Name         string            `json:"name"`
	Type         string            `json:"type"`
	Enabled      bool              `json:"enabled"`
	StartCommand string            `json:"start_command"`
	Shell        string            `json:"shell"`
	WorkDir      string            `json:"work_dir"`
	ProcessNames []string          `json:"process_names"`
	Ports        []int             `json:"ports"`
	HealthURL    string            `json:"health_url"`
	HealthCmd    string            `json:"health_cmd"`
	LogFiles     []string          `json:"log_files"`
	Description  string            `json:"description"`
	Owner        string            `json:"owner"`
	Notes        string            `json:"notes"`
	Env          map[string]string `json:"env"`
}

type appListItem struct {
	Name             string            `json:"name"`
	Type             string            `json:"type"`
	Enabled          bool              `json:"enabled"`
	StartCommand     string            `json:"start_command"`
	Shell            string            `json:"shell"`
	WorkDir          string            `json:"work_dir"`
	ProcessNames     []string          `json:"process_names"`
	Ports            []int             `json:"ports"`
	HealthURL        string            `json:"health_url"`
	HealthCmd        string            `json:"health_cmd"`
	LogFiles         []string          `json:"log_files"`
	Description      string            `json:"description"`
	Owner            string            `json:"owner"`
	Notes            string            `json:"notes"`
	Env              map[string]string `json:"env"`
	LastStartAt      string            `json:"last_start_at"`
	LastStartStatus  string            `json:"last_start_status"`
	LastStartMessage string            `json:"last_start_message"`
	Status           string            `json:"status"`
	ProcessCount     int               `json:"process_count"`
	BytesIn          uint64            `json:"bytes_in"`
	BytesOut         uint64            `json:"bytes_out"`
}

type appTrafficStat struct {
	BytesIn  uint64
	BytesOut uint64
}

type processCatalogEntry struct {
	PID     int32
	Name    string
	Cmdline string
	ExePath string
}

type scoredMatch struct {
	Entry processCatalogEntry
	Score int
}

func (s *Server) handleAppsList(w http.ResponseWriter, r *http.Request) {
	s.mu.RLock()
	apps := cloneApplications(s.cfg.Applications)
	s.mu.RUnlock()

	metaMap, err := s.loadAppMetaMap()
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}

	catalog := buildProcessCatalog()
	snapshot := s.traffic.Snapshot(0, 0)
	pidTraffic := buildTrafficByPID(snapshot.Connections)

	items := make([]appListItem, 0, len(apps))
	for _, app := range apps {
		meta := metaMap[strings.ToLower(strings.TrimSpace(app.Name))]
		matched := matchAppProcesses(catalog, app.ProcessNames, app.Name, 32)
		processCount := len(matched)
		stat := aggregateTrafficByMatched(matched, pidTraffic)
		status := "down"
		if app.Enabled && processCount > 0 {
			status = "up"
		}
		items = append(items, composeAppItem(app, meta, status, processCount, stat.BytesIn, stat.BytesOut))
	}

	sort.SliceStable(items, func(i, j int) bool {
		return strings.ToLower(items[i].Name) < strings.ToLower(items[j].Name)
	})
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (s *Server) handleAppsCreate(w http.ResponseWriter, r *http.Request) {
	var req appUpsertRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	normalizeAppRequest(&req)
	if req.Name == "" {
		writeErr(w, http.StatusBadRequest, fmt.Errorf("name is required"))
		return
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if _, idx := findAppByName(s.cfg.Applications, req.Name); idx >= 0 {
		writeErr(w, http.StatusConflict, fmt.Errorf("app already exists: %s", req.Name))
		return
	}

	app := requestToConfigApp(req, config.Application{})
	s.cfg.Applications = append(s.cfg.Applications, app)
	if err := s.persistConfigLocked(); err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	if err := s.store.UpsertAppMeta(requestToAppMeta(req, store.AppMeta{AppName: req.Name})); err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) handleAppsUpdate(w http.ResponseWriter, r *http.Request) {
	oldName := strings.TrimSpace(chi.URLParam(r, "name"))
	if oldName == "" {
		writeErr(w, http.StatusBadRequest, fmt.Errorf("name is required"))
		return
	}

	var req appUpsertRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	normalizeAppRequest(&req)
	if req.Name == "" {
		req.Name = oldName
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	existing, idx := findAppByName(s.cfg.Applications, oldName)
	if idx < 0 {
		writeErr(w, http.StatusNotFound, fmt.Errorf("app not found: %s", oldName))
		return
	}
	if !strings.EqualFold(strings.TrimSpace(req.Name), oldName) {
		if _, dup := findAppByName(s.cfg.Applications, req.Name); dup >= 0 {
			writeErr(w, http.StatusConflict, fmt.Errorf("app already exists: %s", req.Name))
			return
		}
	}

	s.cfg.Applications[idx] = requestToConfigApp(req, existing)
	if err := s.persistConfigLocked(); err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}

	currentMeta, metaErr := s.store.GetAppMeta(oldName)
	if metaErr != nil && !errors.Is(metaErr, sql.ErrNoRows) {
		writeErr(w, http.StatusInternalServerError, metaErr)
		return
	}

	baseMeta := store.AppMeta{AppName: req.Name}
	if currentMeta != nil {
		baseMeta = *currentMeta
		baseMeta.AppName = req.Name
	}
	nextMeta := requestToAppMeta(req, baseMeta)
	if err := s.store.UpsertAppMeta(nextMeta); err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	if !strings.EqualFold(strings.TrimSpace(req.Name), oldName) {
		_ = s.store.DeleteAppMeta(oldName)
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) handleAppsDelete(w http.ResponseWriter, r *http.Request) {
	name := strings.TrimSpace(chi.URLParam(r, "name"))
	if name == "" {
		writeErr(w, http.StatusBadRequest, fmt.Errorf("name is required"))
		return
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	_, idx := findAppByName(s.cfg.Applications, name)
	if idx < 0 {
		writeErr(w, http.StatusNotFound, fmt.Errorf("app not found: %s", name))
		return
	}
	s.cfg.Applications = append(s.cfg.Applications[:idx], s.cfg.Applications[idx+1:]...)
	if err := s.persistConfigLocked(); err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	_ = s.store.DeleteAppMeta(name)
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) handleAppsDetail(w http.ResponseWriter, r *http.Request) {
	name := strings.TrimSpace(chi.URLParam(r, "name"))
	if name == "" {
		writeErr(w, http.StatusBadRequest, fmt.Errorf("name is required"))
		return
	}

	s.mu.RLock()
	app, idx := findAppByName(s.cfg.Applications, name)
	s.mu.RUnlock()
	if idx < 0 {
		writeErr(w, http.StatusNotFound, fmt.Errorf("app not found: %s", name))
		return
	}

	metaMap, err := s.loadAppMetaMap()
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}

	catalog := buildProcessCatalog()
	matched := matchAppProcesses(catalog, app.ProcessNames, app.Name, 80)
	pidSet := make(map[int32]struct{}, len(matched))
	for _, item := range matched {
		if item.PID > 0 {
			pidSet[item.PID] = struct{}{}
		}
	}

	snapshot := s.traffic.Snapshot(0, 0)
	trafficRows := make([]any, 0, len(snapshot.Connections))
	var bytesIn, bytesOut uint64
	for _, row := range snapshot.Connections {
		if _, ok := pidSet[row.PID]; !ok {
			continue
		}
		trafficRows = append(trafficRows, row)
		bytesIn += row.BytesIn
		bytesOut += row.BytesOut
	}

	processDetails := make([]monitor.ProcessDetail, 0, len(matched))
	for _, item := range matched {
		detail, err := monitor.GetProcessDetail(item.PID)
		if err != nil || detail == nil {
			continue
		}
		processDetails = append(processDetails, *detail)
	}
	sort.SliceStable(processDetails, func(i, j int) bool {
		if processDetails[i].CPUPercent != processDetails[j].CPUPercent {
			return processDetails[i].CPUPercent > processDetails[j].CPUPercent
		}
		return processDetails[i].PID < processDetails[j].PID
	})

	meta := metaMap[strings.ToLower(strings.TrimSpace(app.Name))]
	status := "down"
	if app.Enabled && len(matched) > 0 {
		status = "up"
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"item":                composeAppItem(app, meta, status, len(matched), bytesIn, bytesOut),
		"process_details":     processDetails,
		"traffic_connections": trafficRows,
	})
}

func (s *Server) handleAppsStart(w http.ResponseWriter, r *http.Request) {
	name := strings.TrimSpace(chi.URLParam(r, "name"))
	if name == "" {
		writeErr(w, http.StatusBadRequest, fmt.Errorf("name is required"))
		return
	}

	s.mu.RLock()
	app, idx := findAppByName(s.cfg.Applications, name)
	systemCfg := s.cfg.System
	s.mu.RUnlock()
	if idx < 0 {
		writeErr(w, http.StatusNotFound, fmt.Errorf("app not found: %s", name))
		return
	}

	cmdText := strings.TrimSpace(app.StartCommand)
	if cmdText == "" {
		writeErr(w, http.StatusBadRequest, fmt.Errorf("start command is empty"))
		return
	}

	meta, _ := s.store.GetAppMeta(app.Name)
	envExtra := map[string]string{}
	if meta != nil {
		envExtra = cloneEnvMap(meta.Env)
	}

	workDir := strings.TrimSpace(app.WorkDir)
	if workDir == "" {
		workDir = strings.TrimSpace(systemCfg.DefaultWorkDir)
	}
	if workDir == "" {
		workDir = "."
	}
	workDir = s.resolvePath(workDir)
	if err := os.MkdirAll(workDir, 0o755); err != nil {
		writeErr(w, http.StatusBadRequest, fmt.Errorf("invalid work_dir: %w", err))
		return
	}

	shell := strings.TrimSpace(app.Shell)
	if shell == "" {
		shell = strings.TrimSpace(systemCfg.DefaultShell)
	}

	cmd := commandForAppStart(shell, cmdText)
	cmd.Dir = filepath.Clean(workDir)
	cmd.Env = buildAppEnv(app.Name, envExtra)

	startedAt := time.Now()
	if err := cmd.Start(); err != nil {
		_ = s.store.UpdateAppStartResult(app.Name, "failed", err.Error(), startedAt)
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	pid := 0
	if cmd.Process != nil {
		pid = cmd.Process.Pid
	}
	msg := fmt.Sprintf("started by %s", shellNameForMessage(shell))
	if pid > 0 {
		msg = fmt.Sprintf("%s pid=%d", msg, pid)
	}
	_ = s.store.UpdateAppStartResult(app.Name, "success", msg, startedAt)

	go func() {
		_ = cmd.Wait()
	}()

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":  true,
		"pid": pid,
	})
}

func cloneApplications(items []config.Application) []config.Application {
	out := make([]config.Application, 0, len(items))
	for _, item := range items {
		c := item
		c.ProcessNames = append([]string(nil), item.ProcessNames...)
		c.Ports = append([]int(nil), item.Ports...)
		c.LogFiles = append([]string(nil), item.LogFiles...)
		out = append(out, c)
	}
	return out
}

func normalizeAppRequest(req *appUpsertRequest) {
	req.Name = strings.TrimSpace(req.Name)
	req.Type = strings.TrimSpace(req.Type)
	req.StartCommand = strings.TrimSpace(req.StartCommand)
	req.Shell = strings.TrimSpace(req.Shell)
	req.WorkDir = strings.TrimSpace(req.WorkDir)
	req.HealthURL = strings.TrimSpace(req.HealthURL)
	req.HealthCmd = strings.TrimSpace(req.HealthCmd)
	req.Description = strings.TrimSpace(req.Description)
	req.Owner = strings.TrimSpace(req.Owner)
	req.Notes = strings.TrimSpace(req.Notes)
	if req.Type == "" {
		req.Type = "application"
	}
	req.ProcessNames = normalizeStringSlice(req.ProcessNames)
	req.LogFiles = normalizeStringSlice(req.LogFiles)
	req.Ports = normalizePortSlice(req.Ports)
	req.Env = normalizeEnvMap(req.Env)
}

func normalizeStringSlice(items []string) []string {
	out := make([]string, 0, len(items))
	seen := make(map[string]struct{}, len(items))
	for _, item := range items {
		item = strings.TrimSpace(item)
		if item == "" {
			continue
		}
		key := strings.ToLower(item)
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		out = append(out, item)
	}
	return out
}

func normalizePortSlice(ports []int) []int {
	out := make([]int, 0, len(ports))
	seen := make(map[int]struct{}, len(ports))
	for _, port := range ports {
		if port <= 0 || port > 65535 {
			continue
		}
		if _, ok := seen[port]; ok {
			continue
		}
		seen[port] = struct{}{}
		out = append(out, port)
	}
	sort.Ints(out)
	return out
}

func normalizeEnvMap(env map[string]string) map[string]string {
	out := make(map[string]string, len(env))
	for key, value := range env {
		k := strings.TrimSpace(key)
		if k == "" {
			continue
		}
		out[k] = strings.TrimSpace(value)
	}
	return out
}

func requestToConfigApp(req appUpsertRequest, base config.Application) config.Application {
	app := base
	app.Name = req.Name
	app.Type = req.Type
	app.Enabled = req.Enabled
	app.StartCommand = req.StartCommand
	app.Shell = req.Shell
	app.WorkDir = req.WorkDir
	app.ProcessNames = append([]string(nil), req.ProcessNames...)
	app.Ports = append([]int(nil), req.Ports...)
	if req.HealthURL != "" || strings.TrimSpace(base.HealthURL) == "" {
		app.HealthURL = req.HealthURL
	}
	if req.HealthCmd != "" || strings.TrimSpace(base.HealthCmd) == "" {
		app.HealthCmd = req.HealthCmd
	}
	if len(req.LogFiles) > 0 || len(base.LogFiles) == 0 {
		app.LogFiles = append([]string(nil), req.LogFiles...)
	}
	return app
}

func requestToAppMeta(req appUpsertRequest, base store.AppMeta) store.AppMeta {
	meta := base
	meta.AppName = req.Name
	meta.Description = req.Description
	meta.Owner = req.Owner
	meta.Notes = req.Notes
	meta.Env = cloneEnvMap(req.Env)
	meta.UpdatedAt = time.Now()
	return meta
}

func cloneEnvMap(src map[string]string) map[string]string {
	if len(src) == 0 {
		return map[string]string{}
	}
	out := make(map[string]string, len(src))
	for key, value := range src {
		out[key] = value
	}
	return out
}

func (s *Server) loadAppMetaMap() (map[string]store.AppMeta, error) {
	items, err := s.store.ListAppMeta()
	if err != nil {
		return nil, err
	}
	out := make(map[string]store.AppMeta, len(items))
	for _, item := range items {
		key := strings.ToLower(strings.TrimSpace(item.AppName))
		if key == "" {
			continue
		}
		out[key] = item
	}
	return out, nil
}

func findAppByName(apps []config.Application, name string) (config.Application, int) {
	key := strings.ToLower(strings.TrimSpace(name))
	for idx, app := range apps {
		if strings.ToLower(strings.TrimSpace(app.Name)) == key {
			return app, idx
		}
	}
	return config.Application{}, -1
}

func composeAppItem(app config.Application, meta store.AppMeta, status string, processCount int, bytesIn, bytesOut uint64) appListItem {
	return appListItem{
		Name:             app.Name,
		Type:             app.Type,
		Enabled:          app.Enabled,
		StartCommand:     app.StartCommand,
		Shell:            app.Shell,
		WorkDir:          app.WorkDir,
		ProcessNames:     append([]string(nil), app.ProcessNames...),
		Ports:            append([]int(nil), app.Ports...),
		HealthURL:        app.HealthURL,
		HealthCmd:        app.HealthCmd,
		LogFiles:         append([]string(nil), app.LogFiles...),
		Description:      meta.Description,
		Owner:            meta.Owner,
		Notes:            meta.Notes,
		Env:              cloneEnvMap(meta.Env),
		LastStartAt:      formatOptionalTime(meta.LastStartAt),
		LastStartStatus:  strings.TrimSpace(meta.LastStartStatus),
		LastStartMessage: strings.TrimSpace(meta.LastStartMessage),
		Status:           status,
		ProcessCount:     processCount,
		BytesIn:          bytesIn,
		BytesOut:         bytesOut,
	}
}

func formatOptionalTime(t time.Time) string {
	if t.IsZero() {
		return ""
	}
	return t.Format(time.RFC3339)
}

func buildTrafficByPID(rows []traffic.ConnectionRow) map[int32]appTrafficStat {
	out := make(map[int32]appTrafficStat, 128)
	for _, row := range rows {
		if row.PID <= 0 {
			continue
		}
		stat := out[row.PID]
		stat.BytesIn += row.BytesIn
		stat.BytesOut += row.BytesOut
		out[row.PID] = stat
	}
	return out
}

func aggregateTrafficByMatched(matched []processCatalogEntry, byPID map[int32]appTrafficStat) appTrafficStat {
	var out appTrafficStat
	seen := make(map[int32]struct{}, len(matched))
	for _, item := range matched {
		if item.PID <= 0 {
			continue
		}
		if _, ok := seen[item.PID]; ok {
			continue
		}
		seen[item.PID] = struct{}{}
		stat := byPID[item.PID]
		out.BytesIn += stat.BytesIn
		out.BytesOut += stat.BytesOut
	}
	return out
}

func buildProcessCatalog() []processCatalogEntry {
	ps, err := process.Processes()
	if err != nil {
		return nil
	}
	out := make([]processCatalogEntry, 0, len(ps))
	for _, p := range ps {
		name, _ := p.Name()
		cmdline, _ := p.Cmdline()
		exe, _ := p.Exe()
		if strings.TrimSpace(exe) == "" {
			exe = executableFromCmdline(cmdline)
		}
		if strings.TrimSpace(name) == "" && strings.TrimSpace(exe) != "" {
			name = filepath.Base(exe)
		}
		out = append(out, processCatalogEntry{
			PID:     p.Pid,
			Name:    strings.TrimSpace(name),
			Cmdline: strings.TrimSpace(cmdline),
			ExePath: strings.TrimSpace(exe),
		})
	}
	return out
}

func matchAppProcesses(catalog []processCatalogEntry, patterns []string, appName string, limit int) []processCatalogEntry {
	if len(catalog) == 0 {
		return nil
	}
	keys := make([]string, 0, len(patterns)+1)
	for _, item := range patterns {
		token := normalizeMatchToken(item)
		if token != "" {
			keys = append(keys, token)
		}
	}
	if len(keys) == 0 {
		if token := normalizeMatchToken(appName); token != "" {
			keys = append(keys, token)
		}
	}
	if len(keys) == 0 {
		return nil
	}

	serviceKey := normalizeMatchToken(appName)
	byPID := make(map[int32]scoredMatch, len(catalog))
	for _, entry := range catalog {
		for idx, key := range keys {
			score := scoreAppProcessMatch(entry, key, idx, serviceKey)
			if score <= 0 {
				continue
			}
			prev, exists := byPID[entry.PID]
			if !exists || score > prev.Score {
				byPID[entry.PID] = scoredMatch{Entry: entry, Score: score}
			}
			break
		}
	}
	if len(byPID) == 0 {
		return nil
	}

	scored := make([]scoredMatch, 0, len(byPID))
	for _, item := range byPID {
		scored = append(scored, item)
	}
	sort.SliceStable(scored, func(i, j int) bool {
		if scored[i].Score != scored[j].Score {
			return scored[i].Score > scored[j].Score
		}
		in := strings.ToLower(strings.TrimSpace(scored[i].Entry.Name))
		jn := strings.ToLower(strings.TrimSpace(scored[j].Entry.Name))
		if in != jn {
			return in < jn
		}
		return scored[i].Entry.PID < scored[j].Entry.PID
	})
	if limit > 0 && len(scored) > limit {
		scored = scored[:limit]
	}
	out := make([]processCatalogEntry, 0, len(scored))
	for _, item := range scored {
		out = append(out, item.Entry)
	}
	return out
}

func normalizeMatchToken(raw string) string {
	token := strings.ToLower(strings.TrimSpace(raw))
	token = strings.Trim(token, `"'`)
	token = strings.TrimPrefix(token, "./")
	token = strings.TrimPrefix(token, ".\\")
	token = strings.TrimSuffix(token, ".exe")
	token = strings.Trim(token, `\/`)
	return token
}

func scoreAppProcessMatch(entry processCatalogEntry, key string, patternIndex int, serviceKey string) int {
	key = normalizeMatchToken(key)
	if key == "" {
		return 0
	}

	name := normalizeMatchToken(entry.Name)
	exeBase := normalizeMatchToken(filepath.Base(entry.ExePath))
	exePath := strings.ToLower(strings.TrimSpace(entry.ExePath))
	cmdline := strings.ToLower(strings.TrimSpace(entry.Cmdline))

	score := 100 - patternIndex*8
	if score < 20 {
		score = 20
	}

	if key == name || key == exeBase {
		score += 120
	} else if strings.HasPrefix(name, key) || strings.HasPrefix(exeBase, key) {
		score += 80
	} else if containsWord(name, key) || containsWord(exeBase, key) {
		score += 70
	}

	if strings.Contains(exePath, "/"+key) || strings.Contains(exePath, `\`+key) {
		score += 60
	}
	if containsWord(cmdline, key) {
		score += 50
	}

	if len(key) >= 4 {
		if strings.Contains(name, key) {
			score += 20
		}
		if strings.Contains(exeBase, key) {
			score += 20
		}
	}
	if len(key) >= 5 && strings.Contains(cmdline, key) {
		score += 8
	}

	if serviceKey != "" && serviceKey != key {
		if strings.Contains(name, serviceKey) || strings.Contains(exeBase, serviceKey) {
			score += 35
		} else if containsWord(cmdline, serviceKey) {
			score += 22
		}
	}

	if score < 120 {
		return 0
	}
	return score
}

func containsWord(text, token string) bool {
	text = strings.ToLower(strings.TrimSpace(text))
	token = strings.ToLower(strings.TrimSpace(token))
	if text == "" || token == "" {
		return false
	}
	idx := strings.Index(text, token)
	for idx >= 0 {
		beforeOK := idx == 0 || !isWordChar(text[idx-1])
		afterIdx := idx + len(token)
		afterOK := afterIdx >= len(text) || !isWordChar(text[afterIdx])
		if beforeOK && afterOK {
			return true
		}
		next := idx + len(token)
		if next >= len(text) {
			break
		}
		n := strings.Index(text[next:], token)
		if n < 0 {
			break
		}
		idx = next + n
	}
	return false
}

func isWordChar(b byte) bool {
	return (b >= 'a' && b <= 'z') || (b >= '0' && b <= '9') || b == '_' || b == '-' || b == '.'
}

func executableFromCmdline(cmdline string) string {
	s := strings.TrimSpace(cmdline)
	if s == "" {
		return ""
	}
	if strings.HasPrefix(s, "\"") {
		rest := s[1:]
		if idx := strings.Index(rest, "\""); idx >= 0 {
			return strings.TrimSpace(rest[:idx])
		}
	}
	fields := strings.Fields(s)
	if len(fields) == 0 {
		return ""
	}
	return strings.Trim(fields[0], "\"")
}

func commandForAppStart(shell, command string) *exec.Cmd {
	sh := strings.ToLower(strings.TrimSpace(shell))
	switch sh {
	case "powershell", "pwsh":
		bin := "powershell"
		if sh == "pwsh" {
			bin = "pwsh"
		}
		return exec.Command(bin, "-NoProfile", "-Command", command)
	case "cmd":
		return exec.Command("cmd", "/C", command)
	case "bash":
		return exec.Command("bash", "-lc", command)
	case "sh":
		return exec.Command("sh", "-lc", command)
	default:
		if runtime.GOOS == "windows" {
			return exec.Command("powershell", "-NoProfile", "-Command", command)
		}
		return exec.Command("sh", "-lc", command)
	}
}

func buildAppEnv(appName string, extra map[string]string) []string {
	env := append([]string(nil), os.Environ()...)
	env = append(env, "OPS_APP_NAME="+strings.TrimSpace(appName))
	for key, value := range extra {
		k := strings.TrimSpace(key)
		if k == "" {
			continue
		}
		env = append(env, k+"="+strings.TrimSpace(value))
	}
	return env
}

func shellNameForMessage(shell string) string {
	v := strings.TrimSpace(shell)
	if v != "" {
		return v
	}
	if runtime.GOOS == "windows" {
		return "powershell"
	}
	return "sh"
}
