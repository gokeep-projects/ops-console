package web

import (
	"net/http"
	"strconv"
	"strings"

	"ops-tool/internal/config"
	"ops-tool/internal/systemlog"
)

func (s *Server) persistConfigLocked() error {
	if err := config.Save(s.configPath, s.cfg); err != nil {
		return err
	}
	return s.store.SyncConfig(s.cfg)
}

func (s *Server) handleRuntimeLogs(w http.ResponseWriter, r *http.Request) {
	limit, _ := strconv.Atoi(strings.TrimSpace(r.URL.Query().Get("limit")))
	keyword := strings.TrimSpace(r.URL.Query().Get("keyword"))
	level := strings.TrimSpace(r.URL.Query().Get("level"))
	items := systemlog.List(limit, keyword, level)

	s.mu.RLock()
	cfg := s.cfg.System.RuntimeLogs
	s.mu.RUnlock()

	writeJSON(w, http.StatusOK, map[string]any{
		"items": items,
		"config": map[string]any{
			"enabled":     cfg.Enabled,
			"file_path":   s.resolvePath(cfg.FilePath),
			"max_entries": cfg.MaxEntries,
		},
	})
}

func (s *Server) handleSystemMenu(w http.ResponseWriter, r *http.Request) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	writeJSON(w, http.StatusOK, map[string]any{
		"site_title":      s.cfg.System.SiteTitle,
		"environment":     s.cfg.System.Environment,
		"menu_visibility": s.cfg.System.MenuVisibility,
	})
}
