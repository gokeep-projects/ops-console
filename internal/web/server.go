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

	cleanupJobMu sync.RWMutex
	cleanupJobs  map[string]*cleanupScanJob
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
		cleanupJobs:  make(map[string]*cleanupScanJob),
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

		pr.Get("/api/traffic", s.handleTrafficSnapshot)
		pr.Get("/api/traffic/interfaces", s.handleTrafficInterfaces)
		pr.Post("/api/traffic/capture/start", s.handleTrafficCaptureStart)
		pr.Post("/api/traffic/capture/stop", s.handleTrafficCaptureStop)

		pr.Get("/api/scripts", s.handleScripts)
		pr.Post("/api/scripts/upload", s.handleScriptUpload)
		pr.Post("/api/scripts/run", s.handleScriptRun)
		pr.Get("/api/scripts/runs", s.handleScriptRuns)
		pr.Get("/api/scripts/runs/{id}", s.handleScriptRunDetail)

		pr.Get("/api/backups", s.handleBackups)
		pr.Post("/api/backups/run", s.handleBackupRun)
		pr.Get("/api/backups/download", s.handleBackupDownload)

		pr.Get("/api/cleanup/meta", s.handleCleanupMeta)
		pr.Post("/api/cleanup/scan", s.handleCleanupScan)
		pr.Post("/api/cleanup/scan-jobs", s.handleCleanupScanJobCreate)
		pr.Get("/api/cleanup/scan-jobs/{jobID}", s.handleCleanupScanJobStatus)
		pr.Post("/api/cleanup/scan-jobs/{jobID}/cancel", s.handleCleanupScanJobCancel)
		pr.Post("/api/cleanup/garbage", s.handleCleanupGarbage)
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
