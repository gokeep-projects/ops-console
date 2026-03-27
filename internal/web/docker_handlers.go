package web

import (
	"context"
	"encoding/json"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"ops-tool/internal/docker"

	"github.com/go-chi/chi/v5"
)

func (s *Server) handleDockerStatus(w http.ResponseWriter, r *http.Request) {
	client := docker.NewClient(15 * time.Second)
	status := client.Status(r.Context())
	writeJSON(w, http.StatusOK, status)
}

func (s *Server) handleDockerContainers(w http.ResponseWriter, r *http.Request) {
	client := docker.NewClient(20 * time.Second)
	status := client.Status(r.Context())
	page := parsePositiveInt(r.URL.Query().Get("page"), 1)
	pageSize := parsePositiveInt(r.URL.Query().Get("page_size"), 20)
	keyword := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("keyword")))
	if pageSize > 200 {
		pageSize = 200
	}
	if !status.Installed || !status.DaemonRunning {
		writeJSON(w, http.StatusOK, map[string]any{
			"status":      status,
			"items":       []docker.Container{},
			"total":       0,
			"page":        page,
			"page_size":   pageSize,
			"total_pages": 0,
		})
		return
	}

	all := true
	switch strings.TrimSpace(strings.ToLower(r.URL.Query().Get("all"))) {
	case "0", "false", "running":
		all = false
	}
	items, err := client.ListContainers(r.Context(), all)
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]any{
			"status":      status,
			"items":       []docker.Container{},
			"total":       0,
			"page":        page,
			"page_size":   pageSize,
			"total_pages": 0,
			"error":       err.Error(),
		})
		return
	}
	if keyword != "" {
		filtered := make([]docker.Container, 0, len(items))
		for _, item := range items {
			searchable := strings.ToLower(strings.TrimSpace(item.Name + " " + item.Image + " " + item.ID + " " + item.Status))
			if strings.Contains(searchable, keyword) {
				filtered = append(filtered, item)
			}
		}
		items = filtered
	}

	sort.SliceStable(items, func(i, j int) bool {
		ri := strings.EqualFold(strings.TrimSpace(items[i].State), "running")
		rj := strings.EqualFold(strings.TrimSpace(items[j].State), "running")
		if ri != rj {
			return ri
		}
		ni := strings.ToLower(strings.TrimSpace(items[i].Name))
		nj := strings.ToLower(strings.TrimSpace(items[j].Name))
		if ni != nj {
			return ni < nj
		}
		return strings.ToLower(strings.TrimSpace(items[i].ID)) < strings.ToLower(strings.TrimSpace(items[j].ID))
	})

	total := len(items)
	totalPages := 0
	if total > 0 {
		totalPages = (total + pageSize - 1) / pageSize
	}
	if totalPages > 0 && page > totalPages {
		page = totalPages
	}
	start, end := paginationWindow(total, page, pageSize)
	paged := []docker.Container{}
	if start < end {
		paged = items[start:end]
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"status":      status,
		"items":       paged,
		"total":       total,
		"page":        page,
		"page_size":   pageSize,
		"total_pages": totalPages,
	})
}

func (s *Server) handleDockerContainerAction(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimSpace(chi.URLParam(r, "id"))
	if id == "" {
		writeErr(w, http.StatusBadRequest, errInvalidDockerContainerID)
		return
	}

	var req struct {
		Action        string `json:"action"`
		RemoveVolumes bool   `json:"remove_volumes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}

	req.Action = strings.ToLower(strings.TrimSpace(req.Action))
	if req.Action == "" {
		writeErr(w, http.StatusBadRequest, errInvalidDockerAction)
		return
	}

	client := docker.NewClient(30 * time.Second)
	status := client.Status(r.Context())
	if !status.Installed || !status.DaemonRunning {
		writeErr(w, http.StatusBadRequest, errDockerUnavailable(status.Error))
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 35*time.Second)
	defer cancel()
	out, err := client.ContainerAction(ctx, id, req.Action, docker.ContainerActionOptions{
		RemoveVolumes: req.RemoveVolumes,
	})
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":             true,
		"id":             id,
		"action":         req.Action,
		"message":        out,
		"remove_volumes": req.RemoveVolumes,
	})
}

func (s *Server) handleDockerContainerLogs(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimSpace(chi.URLParam(r, "id"))
	if id == "" {
		writeErr(w, http.StatusBadRequest, errInvalidDockerContainerID)
		return
	}
	tail, _ := strconv.Atoi(strings.TrimSpace(r.URL.Query().Get("tail")))
	if tail <= 0 {
		tail = 300
	}
	if tail > 4000 {
		tail = 4000
	}

	client := docker.NewClient(30 * time.Second)
	status := client.Status(r.Context())
	if !status.Installed || !status.DaemonRunning {
		writeErr(w, http.StatusBadRequest, errDockerUnavailable(status.Error))
		return
	}
	logText, err := client.ContainerLogs(r.Context(), id, tail)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"id":   id,
		"tail": tail,
		"logs": logText,
	})
}

func (s *Server) handleDockerContainerInspect(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimSpace(chi.URLParam(r, "id"))
	if id == "" {
		writeErr(w, http.StatusBadRequest, errInvalidDockerContainerID)
		return
	}

	client := docker.NewClient(25 * time.Second)
	status := client.Status(r.Context())
	if !status.Installed || !status.DaemonRunning {
		writeErr(w, http.StatusBadRequest, errDockerUnavailable(status.Error))
		return
	}

	text, err := client.ContainerInspect(r.Context(), id)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}

	var payload any
	if err := json.Unmarshal([]byte(text), &payload); err != nil {
		writeJSON(w, http.StatusOK, map[string]any{
			"id":      id,
			"inspect": text,
		})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"id":      id,
		"inspect": payload,
	})
}

var (
	errInvalidDockerContainerID = dockerError("container id is required")
	errInvalidDockerAction      = dockerError("action is required")
)

type dockerError string

func (e dockerError) Error() string { return string(e) }

func errDockerUnavailable(detail string) error {
	_ = detail
	return dockerError("Docker 服务未就绪，请先安装或启动 Docker")
}

func parsePositiveInt(raw string, def int) int {
	n, err := strconv.Atoi(strings.TrimSpace(raw))
	if err != nil || n <= 0 {
		return def
	}
	return n
}

func paginationWindow(total, page, pageSize int) (int, int) {
	if total <= 0 || pageSize <= 0 || page <= 0 {
		return 0, 0
	}
	start := (page - 1) * pageSize
	if start >= total {
		return 0, 0
	}
	end := start + pageSize
	if end > total {
		end = total
	}
	return start, end
}
