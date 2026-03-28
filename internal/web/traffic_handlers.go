package web

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
)

func (s *Server) handleTrafficInterfaces(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"items": s.traffic.Interfaces(),
	})
}

func (s *Server) handleTrafficSnapshot(w http.ResponseWriter, r *http.Request) {
	packetLimit, _ := strconv.Atoi(strings.TrimSpace(r.URL.Query().Get("packet_limit")))
	httpLimit, _ := strconv.Atoi(strings.TrimSpace(r.URL.Query().Get("http_limit")))
	writeJSON(w, http.StatusOK, s.traffic.Snapshot(packetLimit, httpLimit))
}

func (s *Server) handleTrafficCaptureStart(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Interface string `json:"interface"`
		Filter    string `json:"filter"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	if err := s.traffic.StartCapture(req.Interface, req.Filter); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) handleTrafficCaptureStop(w http.ResponseWriter, r *http.Request) {
	s.traffic.StopCapture()
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}
