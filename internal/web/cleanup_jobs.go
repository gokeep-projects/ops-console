package web

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"ops-tool/internal/cleanup"

	"github.com/go-chi/chi/v5"
)

type cleanupScanJob struct {
	mu       sync.RWMutex
	id       string
	progress cleanup.ScanProgress
	result   *cleanup.ScanResult
	err      string
	status   string
	cancel   context.CancelFunc
}

func (j *cleanupScanJob) snapshot() map[string]any {
	j.mu.RLock()
	defer j.mu.RUnlock()
	return map[string]any{
		"id":       j.id,
		"status":   j.status,
		"progress": j.progress,
		"result":   j.result,
		"error":    j.err,
	}
}

func (s *Server) handleCleanupScanJobCreate(w http.ResponseWriter, r *http.Request) {
	req := cleanupScanRequest{}
	if err := readOptionalJSON(r, &req); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	jobID := strconv.FormatInt(time.Now().UnixNano(), 36)
	ctx, cancel := context.WithCancel(context.Background())
	job := &cleanupScanJob{
		id:     jobID,
		status: "running",
		cancel: cancel,
	}

	s.cleanupJobMu.Lock()
	s.cleanupJobs[jobID] = job
	s.cleanupJobMu.Unlock()

	s.mu.RLock()
	progressInterval := time.Duration(maxInt(s.cfg.System.Performance.CleanupProgressInterval, 100)) * time.Millisecond
	s.mu.RUnlock()

	go func() {
		res := cleanup.ScanFiles(cleanup.ScanOptions{
			Context:            ctx,
			Roots:              req.Roots,
			Query:              strings.TrimSpace(req.Query),
			MaxEntries:         req.Limit,
			LargeFileThreshold: req.LargeFileSizeBytes,
			LargeLimit:         req.LargeLimit,
			SummaryLimit:       req.SummaryLimit,
			ProgressInterval:   progressInterval,
			OnProgress: func(p cleanup.ScanProgress) {
				job.mu.Lock()
				job.progress = p
				job.status = "running"
				job.mu.Unlock()
			},
		})

		job.mu.Lock()
		job.progress.Finished = true
		job.progress.Cancelled = res.Cancelled
		job.progress.UpdatedAt = time.Now()
		job.result = &res
		if res.Cancelled {
			job.status = "cancelled"
		} else {
			job.status = "done"
		}
		job.mu.Unlock()
	}()

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":     true,
		"job_id": jobID,
	})
}

func (s *Server) handleCleanupScanJobStatus(w http.ResponseWriter, r *http.Request) {
	job := s.getCleanupJob(chi.URLParam(r, "jobID"))
	if job == nil {
		writeErr(w, http.StatusNotFound, fmt.Errorf("scan job not found"))
		return
	}
	writeJSON(w, http.StatusOK, job.snapshot())
}

func (s *Server) handleCleanupScanJobCancel(w http.ResponseWriter, r *http.Request) {
	job := s.getCleanupJob(chi.URLParam(r, "jobID"))
	if job == nil {
		writeErr(w, http.StatusNotFound, fmt.Errorf("scan job not found"))
		return
	}
	job.mu.Lock()
	if job.cancel != nil {
		job.cancel()
	}
	job.status = "cancelled"
	job.mu.Unlock()
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) getCleanupJob(jobID string) *cleanupScanJob {
	jobID = strings.TrimSpace(jobID)
	if jobID == "" {
		return nil
	}
	s.cleanupJobMu.RLock()
	defer s.cleanupJobMu.RUnlock()
	return s.cleanupJobs[jobID]
}

func readOptionalJSON(r *http.Request, out any) error {
	if r == nil || r.Body == nil {
		return nil
	}
	if err := json.NewDecoder(r.Body).Decode(out); err != nil && !errors.Is(err, io.EOF) {
		return err
	}
	return nil
}

func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}
