package web

import (
	"context"
	"encoding/json"
	"net/http"
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
	if !status.Installed || !status.DaemonRunning {
		writeJSON(w, http.StatusOK, map[string]any{
			"status": status,
			"items":  []docker.Container{},
			"total":  0,
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
			"status": status,
			"items":  []docker.Container{},
			"total":  0,
			"error":  err.Error(),
		})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"status": status,
		"items":  items,
		"total":  len(items),
	})
}

func (s *Server) handleDockerContainerAction(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimSpace(chi.URLParam(r, "id"))
	if id == "" {
		writeErr(w, http.StatusBadRequest, errInvalidDockerContainerID)
		return
	}

	var req struct {
		Action string `json:"action"`
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
	out, err := client.ContainerAction(ctx, id, req.Action)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":      true,
		"id":      id,
		"action":  req.Action,
		"message": out,
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
