package web

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"runtime"
	"strings"

	"ops-tool/internal/cleanup"
)

type cleanupScanRequest struct {
	Roots              []string `json:"roots"`
	Query              string   `json:"query"`
	Limit              int      `json:"limit"`
	LargeFileSizeBytes uint64   `json:"large_file_size_bytes"`
	LargeLimit         int      `json:"large_limit"`
	SummaryLimit       int      `json:"summary_limit"`
}

type cleanupGarbageRequest struct {
	TargetIDs []string `json:"target_ids"`
	DryRun    *bool    `json:"dry_run"`
	Limit     int      `json:"limit"`
}

type cleanupRootOption struct {
	Path     string `json:"path"`
	Label    string `json:"label"`
	Selected bool   `json:"selected"`
}

func (s *Server) handleCleanupMeta(w http.ResponseWriter, r *http.Request) {
	roots := cleanup.DefaultScanRoots()
	rootOptions := buildCleanupRootOptions(runtime.GOOS, roots)
	writeJSON(w, http.StatusOK, map[string]any{
		"os":                            runtime.GOOS,
		"default_roots":                 roots,
		"root_options":                  rootOptions,
		"default_large_file_size_bytes": cleanup.DefaultLargeFileThreshold,
		"default_scan_limit":            cleanup.DefaultScanEntryLimit,
		"default_summary_limit":         cleanup.DefaultSummaryEntryLimit,
		"default_garbage_limit":         cleanup.DefaultGarbageCandidateLimit,
		"fast_indexer":                  cleanup.DetectFastIndexer(),
		"garbage_targets":               cleanup.BuildGarbageTargets(s.baseDir),
	})
}

func buildCleanupRootOptions(goos string, roots []string) []cleanupRootOption {
	options := make([]cleanupRootOption, 0, len(roots))
	if len(roots) == 0 {
		return options
	}

	defaultPick := map[string]struct{}{}
	switch strings.ToLower(strings.TrimSpace(goos)) {
	case "windows":
		for _, path := range roots {
			if strings.EqualFold(strings.TrimSpace(path), `C:\`) {
				defaultPick[strings.ToLower(strings.TrimSpace(path))] = struct{}{}
				break
			}
		}
		if len(defaultPick) == 0 {
			defaultPick[strings.ToLower(strings.TrimSpace(roots[0]))] = struct{}{}
		}
	default:
		hasRoot := false
		for _, path := range roots {
			if strings.TrimSpace(path) == "/" {
				defaultPick["/"] = struct{}{}
				hasRoot = true
				break
			}
		}
		if !hasRoot {
			defaultPick[strings.TrimSpace(roots[0])] = struct{}{}
		}
	}

	for _, root := range roots {
		p := strings.TrimSpace(root)
		if p == "" {
			continue
		}
		key := p
		if strings.EqualFold(goos, "windows") {
			key = strings.ToLower(p)
		}
		label := p
		if strings.EqualFold(goos, "windows") {
			trimmed := strings.TrimSuffix(strings.TrimSuffix(p, `\`), "/")
			if len(trimmed) == 2 && strings.HasSuffix(trimmed, ":") {
				label = trimmed + " Drive"
			}
		}
		_, selected := defaultPick[key]
		options = append(options, cleanupRootOption{
			Path:     p,
			Label:    label,
			Selected: selected,
		})
	}
	return options
}

func (s *Server) handleCleanupScan(w http.ResponseWriter, r *http.Request) {
	req := cleanupScanRequest{}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil && !errors.Is(err, io.EOF) {
		writeErr(w, http.StatusBadRequest, err)
		return
	}

	req.Query = strings.TrimSpace(req.Query)
	res := cleanup.ScanFiles(cleanup.ScanOptions{
		Context:            r.Context(),
		Roots:              req.Roots,
		Query:              req.Query,
		MaxEntries:         req.Limit,
		LargeFileThreshold: req.LargeFileSizeBytes,
		LargeLimit:         req.LargeLimit,
		SummaryLimit:       req.SummaryLimit,
	})
	if errors.Is(r.Context().Err(), context.Canceled) {
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"scan":         res,
		"fast_indexer": cleanup.DetectFastIndexer(),
	})
}

func (s *Server) handleCleanupGarbage(w http.ResponseWriter, r *http.Request) {
	req := cleanupGarbageRequest{}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil && !errors.Is(err, io.EOF) {
		writeErr(w, http.StatusBadRequest, err)
		return
	}

	dryRun := true
	if req.DryRun != nil {
		dryRun = *req.DryRun
	}

	res, err := cleanup.RunGarbageCleanup(cleanup.GarbageOptions{
		Context:        r.Context(),
		BaseDir:        s.baseDir,
		TargetIDs:      req.TargetIDs,
		DryRun:         dryRun,
		CandidateLimit: req.Limit,
	})
	if err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusOK, res)
}
