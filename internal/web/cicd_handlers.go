package web

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"ops-tool/internal/config"

	"github.com/go-chi/chi/v5"
)

func (s *Server) handleCICDPipelines(w http.ResponseWriter, r *http.Request) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	writeJSON(w, http.StatusOK, map[string]any{
		"enabled":   s.cfg.CICD.Enabled,
		"pipelines": s.cfg.CICD.Pipelines,
		"system": map[string]any{
			"default_shell":    s.cfg.System.DefaultShell,
			"default_work_dir": s.resolvePath(s.cfg.System.DefaultWorkDir),
		},
	})
}

func (s *Server) handleCICDPipelineCreate(w http.ResponseWriter, r *http.Request) {
	var req config.PipelineConfig
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()

	s.cfg.CICD.Pipelines = append(s.cfg.CICD.Pipelines, req)
	config.EnsurePipelineDefaults(s.cfg)
	last := s.cfg.CICD.Pipelines[len(s.cfg.CICD.Pipelines)-1]
	for i := 0; i < len(s.cfg.CICD.Pipelines)-1; i++ {
		if strings.EqualFold(strings.TrimSpace(s.cfg.CICD.Pipelines[i].ID), strings.TrimSpace(last.ID)) {
			writeErr(w, http.StatusConflict, fmt.Errorf("pipeline id already exists: %s", last.ID))
			s.cfg.CICD.Pipelines = s.cfg.CICD.Pipelines[:len(s.cfg.CICD.Pipelines)-1]
			return
		}
	}
	if err := s.persistConfigLocked(); err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "pipeline": last})
}

func (s *Server) handleCICDPipelineUpdate(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimSpace(chi.URLParam(r, "id"))
	if id == "" {
		writeErr(w, http.StatusBadRequest, fmt.Errorf("pipeline id is required"))
		return
	}
	var req config.PipelineConfig
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()

	_, idx, ok := s.cfg.FindPipeline(id)
	if !ok {
		writeErr(w, http.StatusNotFound, fmt.Errorf("pipeline not found: %s", id))
		return
	}
	req.ID = id
	s.cfg.CICD.Pipelines[idx] = req
	config.EnsurePipelineDefaults(s.cfg)
	if err := s.persistConfigLocked(); err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "pipeline": s.cfg.CICD.Pipelines[idx]})
}

func (s *Server) handleCICDPipelineDelete(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimSpace(chi.URLParam(r, "id"))
	if id == "" {
		writeErr(w, http.StatusBadRequest, fmt.Errorf("pipeline id is required"))
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()

	_, idx, ok := s.cfg.FindPipeline(id)
	if !ok {
		writeErr(w, http.StatusNotFound, fmt.Errorf("pipeline not found: %s", id))
		return
	}
	s.cfg.CICD.Pipelines = append(s.cfg.CICD.Pipelines[:idx], s.cfg.CICD.Pipelines[idx+1:]...)
	if err := s.persistConfigLocked(); err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) handleCICDPipelineRun(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimSpace(chi.URLParam(r, "id"))
	if id == "" {
		writeErr(w, http.StatusBadRequest, fmt.Errorf("pipeline id is required"))
		return
	}
	s.mu.RLock()
	pipeline, _, ok := s.cfg.FindPipeline(id)
	systemCfg := s.cfg.System
	s.mu.RUnlock()
	if !ok {
		writeErr(w, http.StatusNotFound, fmt.Errorf("pipeline not found: %s", id))
		return
	}
	runID, err := s.cicd.Start(s.baseDir, systemCfg, pipeline)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":          true,
		"run_id":      runID,
		"pipeline_id": pipeline.ID,
	})
}

func (s *Server) handleCICDRuns(w http.ResponseWriter, r *http.Request) {
	limit, _ := strconv.Atoi(strings.TrimSpace(r.URL.Query().Get("limit")))
	items, err := s.store.ListCICDRuns(limit)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (s *Server) handleCICDRunDetail(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(strings.TrimSpace(chi.URLParam(r, "id")), 10, 64)
	if err != nil || id <= 0 {
		writeErr(w, http.StatusBadRequest, fmt.Errorf("invalid run id"))
		return
	}
	item, err := s.store.GetCICDRun(id)
	if err != nil {
		writeErr(w, http.StatusNotFound, err)
		return
	}
	writeJSON(w, http.StatusOK, item)
}

func (s *Server) handleCICDRunStop(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(strings.TrimSpace(chi.URLParam(r, "id")), 10, 64)
	if err != nil || id <= 0 {
		writeErr(w, http.StatusBadRequest, fmt.Errorf("invalid run id"))
		return
	}
	if !s.cicd.Stop(id) {
		writeErr(w, http.StatusNotFound, fmt.Errorf("run not found or already finished"))
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "id": id})
}
