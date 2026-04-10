package web

import "net/http"

func (s *Server) handleTrafficSnapshot(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, s.traffic.Snapshot(0, 0))
}
