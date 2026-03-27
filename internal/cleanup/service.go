package cleanup

import (
	"container/heap"
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"time"

	"github.com/shirou/gopsutil/v3/disk"
)

const (
	DefaultLargeFileThreshold    uint64 = 1 << 30 // 1GB
	DefaultScanEntryLimit               = 12000
	MaxScanEntryLimit                   = 120000
	DefaultLargeFileLimit               = 4000
	MaxLargeFileLimit                   = 30000
	DefaultSummaryEntryLimit            = 200
	MaxSummaryEntryLimit                = 2000
	DefaultGarbageCandidateLimit        = 5000
	MaxGarbageCandidateLimit            = 50000
)

type FastIndexerInfo struct {
	Name      string `json:"name"`
	Available bool   `json:"available"`
	Command   string `json:"command,omitempty"`
	Note      string `json:"note,omitempty"`
}

type FileEntry struct {
	Path      string    `json:"path"`
	Name      string    `json:"name"`
	Type      string    `json:"type"`
	Size      uint64    `json:"size"`
	SizeRatio float64   `json:"size_ratio"`
	ModTime   time.Time `json:"mod_time"`
}

type DirectorySummary struct {
	Path      string  `json:"path"`
	FileCount int     `json:"file_count"`
	Size      uint64  `json:"size"`
	SizeRatio float64 `json:"size_ratio"`
}

type TypeSummary struct {
	Type      string  `json:"type"`
	FileCount int     `json:"file_count"`
	Size      uint64  `json:"size"`
	SizeRatio float64 `json:"size_ratio"`
}

type summaryStat struct {
	fileCount int
	totalSize uint64
}

type ScanOptions struct {
	Context            context.Context
	Roots              []string
	Query              string
	MaxEntries         int
	LargeFileThreshold uint64
	LargeLimit         int
	SummaryLimit       int
}

type ScanResult struct {
	Roots             []string           `json:"roots"`
	Files             []FileEntry        `json:"files"`
	LargeFiles        []FileEntry        `json:"large_files"`
	DirectorySummary  []DirectorySummary `json:"directory_summary"`
	TypeSummary       []TypeSummary      `json:"type_summary"`
	ScannedFiles      int                `json:"scanned_files"`
	ScannedDirs       int                `json:"scanned_dirs"`
	MatchedFiles      int                `json:"matched_files"`
	TotalBytes        uint64             `json:"total_bytes"`
	MatchedTotalBytes uint64             `json:"matched_total_bytes"`
	DurationMS        int64              `json:"duration_ms"`
	Cancelled         bool               `json:"cancelled"`
	Truncated         bool               `json:"truncated"`
	LargeTruncated    bool               `json:"large_truncated"`
	Errors            []string           `json:"errors,omitempty"`
}

type GarbageTarget struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Path        string   `json:"path"`
	Description string   `json:"description"`
	KeepHours   int      `json:"keep_hours"`
	Patterns    []string `json:"patterns"`
	Enabled     bool     `json:"enabled"`
	Exists      bool     `json:"exists"`
}

type GarbageOptions struct {
	Context        context.Context
	BaseDir        string
	TargetIDs      []string
	DryRun         bool
	CandidateLimit int
}

type GarbageTargetResult struct {
	ID             string      `json:"id"`
	Name           string      `json:"name"`
	Path           string      `json:"path"`
	CandidateFiles int         `json:"candidate_files"`
	CandidateBytes uint64      `json:"candidate_bytes"`
	DeletedFiles   int         `json:"deleted_files"`
	DeletedBytes   uint64      `json:"deleted_bytes"`
	FailedFiles    int         `json:"failed_files"`
	Truncated      bool        `json:"truncated"`
	Samples        []FileEntry `json:"samples,omitempty"`
	Errors         []string    `json:"errors,omitempty"`
}

type GarbageResult struct {
	DryRun              bool                  `json:"dry_run"`
	Cancelled           bool                  `json:"cancelled"`
	RequestedTargetIDs  []string              `json:"requested_target_ids"`
	At                  time.Time             `json:"at"`
	Targets             []GarbageTargetResult `json:"targets"`
	TotalCandidateFiles int                   `json:"total_candidate_files"`
	TotalCandidateBytes uint64                `json:"total_candidate_bytes"`
	TotalDeletedFiles   int                   `json:"total_deleted_files"`
	TotalDeletedBytes   uint64                `json:"total_deleted_bytes"`
	TotalFailedFiles    int                   `json:"total_failed_files"`
}

func DetectFastIndexer() FastIndexerInfo {
	if runtime.GOOS != "windows" {
		return FastIndexerInfo{
			Name:      "everything",
			Available: false,
			Note:      "built-in scanner",
		}
	}

	for _, bin := range []string{"es.exe", "es"} {
		if path, err := exec.LookPath(bin); err == nil {
			return FastIndexerInfo{
				Name:      "everything",
				Available: true,
				Command:   path,
				Note:      "Everything CLI detected",
			}
		}
	}
	return FastIndexerInfo{
		Name:      "everything",
		Available: false,
		Note:      "Everything CLI not detected",
	}
}
func DefaultScanRoots() []string {
	switch runtime.GOOS {
	case "windows":
		return defaultWindowsRoots()
	default:
		return defaultUnixRoots()
	}
}

func defaultWindowsRoots() []string {
	roots := make([]string, 0, 8)
	for ch := 'A'; ch <= 'Z'; ch++ {
		root := fmt.Sprintf("%c:\\", ch)
		if fi, err := os.Stat(root); err == nil && fi.IsDir() {
			roots = append(roots, root)
		}
	}
	if len(roots) == 0 {
		winDir := strings.TrimSpace(os.Getenv("WINDIR"))
		if winDir != "" {
			vol := filepath.VolumeName(winDir)
			if vol != "" {
				roots = append(roots, vol+`\\`)
			}
		}
	}
	if len(roots) == 0 {
		roots = append(roots, `C:\\`)
	}
	return roots
}

func defaultUnixRoots() []string {
	out := make([]string, 0, 8)
	seen := map[string]struct{}{}

	parts, err := disk.Partitions(true)
	if err == nil {
		for _, part := range parts {
			mp := strings.TrimSpace(part.Mountpoint)
			if mp == "" {
				continue
			}
			if shouldSkipMountpoint(part.Fstype, mp) {
				continue
			}
			mp = filepath.Clean(mp)
			if fi, statErr := os.Stat(mp); statErr != nil || !fi.IsDir() {
				continue
			}
			if _, ok := seen[mp]; ok {
				continue
			}
			seen[mp] = struct{}{}
			out = append(out, mp)
		}
	}

	if len(out) == 0 {
		out = append(out, "/")
	}
	sort.Strings(out)
	return out
}

func shouldSkipMountpoint(fsType string, mountpoint string) bool {
	fs := strings.ToLower(strings.TrimSpace(fsType))
	mp := strings.ToLower(strings.TrimSpace(mountpoint))
	if fs == "" {
		return false
	}
	pseudoFS := map[string]struct{}{
		"proc": {}, "procfs": {}, "sysfs": {}, "devtmpfs": {}, "devfs": {}, "tmpfs": {},
		"overlay": {}, "squashfs": {}, "tracefs": {}, "cgroup": {}, "cgroup2": {},
		"autofs": {}, "fusectl": {}, "mqueue": {}, "nsfs": {}, "debugfs": {},
	}
	if _, ok := pseudoFS[fs]; ok {
		return true
	}
	skipPrefixes := []string{"/proc", "/sys", "/dev", "/run", "/snap"}
	for _, prefix := range skipPrefixes {
		if mp == prefix || strings.HasPrefix(mp, prefix+"/") {
			return true
		}
	}
	return false
}

func NormalizeRoots(roots []string) []string {
	if len(roots) == 0 {
		return DefaultScanRoots()
	}
	out := make([]string, 0, len(roots))
	seen := map[string]struct{}{}
	for _, item := range roots {
		p := strings.TrimSpace(item)
		if p == "" {
			continue
		}
		if !filepath.IsAbs(p) {
			if abs, err := filepath.Abs(p); err == nil {
				p = abs
			}
		}
		p = filepath.Clean(p)
		info, err := os.Stat(p)
		if err != nil {
			continue
		}
		if !info.IsDir() {
			p = filepath.Dir(p)
		}
		key := pathKey(p)
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		out = append(out, p)
	}
	if len(out) == 0 {
		return DefaultScanRoots()
	}
	sort.Strings(out)
	return out
}

func ScanFiles(opts ScanOptions) ScanResult {
	start := time.Now()
	ctx := opts.Context
	if ctx == nil {
		ctx = context.Background()
	}
	roots := NormalizeRoots(opts.Roots)
	maxEntries := clampInt(opts.MaxEntries, DefaultScanEntryLimit, MaxScanEntryLimit)
	largeLimit := clampInt(opts.LargeLimit, DefaultLargeFileLimit, MaxLargeFileLimit)
	summaryLimit := clampInt(opts.SummaryLimit, DefaultSummaryEntryLimit, MaxSummaryEntryLimit)
	largeThreshold := opts.LargeFileThreshold
	if largeThreshold == 0 {
		largeThreshold = DefaultLargeFileThreshold
	}
	query := strings.ToLower(strings.TrimSpace(opts.Query))

	filesHeap := &fileMinHeap{}
	largeHeap := &fileMinHeap{}
	heap.Init(filesHeap)
	heap.Init(largeHeap)

	res := ScanResult{
		Roots:            append([]string(nil), roots...),
		Files:            []FileEntry{},
		LargeFiles:       []FileEntry{},
		DirectorySummary: []DirectorySummary{},
		TypeSummary:      []TypeSummary{},
	}

	dirStats := map[string]*summaryStat{}
	typeStats := map[string]*summaryStat{}

	errs := make([]string, 0, 12)
	errSeen := map[string]struct{}{}
	appendErr := func(err error) {
		if err == nil {
			return
		}
		if errors.Is(err, context.Canceled) {
			return
		}
		msg := strings.TrimSpace(err.Error())
		if msg == "" {
			return
		}
		if _, ok := errSeen[msg]; ok {
			return
		}
		errSeen[msg] = struct{}{}
		if len(errs) < 18 {
			errs = append(errs, msg)
		}
	}

	for _, root := range roots {
		if errors.Is(ctx.Err(), context.Canceled) {
			res.Cancelled = true
			break
		}
		walkErr := filepath.WalkDir(root, func(path string, d os.DirEntry, err error) error {
			if errors.Is(ctx.Err(), context.Canceled) {
				return ctx.Err()
			}
			if err != nil {
				if errors.Is(ctx.Err(), context.Canceled) {
					return ctx.Err()
				}
				appendErr(err)
				if d != nil && d.IsDir() {
					return filepath.SkipDir
				}
				return nil
			}
			if d == nil {
				return nil
			}
			if d.Type()&os.ModeSymlink != 0 {
				if d.IsDir() {
					return filepath.SkipDir
				}
				return nil
			}
			if d.IsDir() {
				res.ScannedDirs++
				return nil
			}
			info, statErr := d.Info()
			if statErr != nil {
				appendErr(statErr)
				return nil
			}
			if !info.Mode().IsRegular() {
				return nil
			}
			size := info.Size()
			if size < 0 {
				size = 0
			}
			entry := FileEntry{
				Path:    path,
				Name:    info.Name(),
				Type:    fileType(info.Name()),
				Size:    uint64(size),
				ModTime: info.ModTime(),
			}

			res.ScannedFiles++
			res.TotalBytes += entry.Size

			if query != "" && !fuzzyMatch(entry, query) {
				return nil
			}

			res.MatchedFiles++
			res.MatchedTotalBytes += entry.Size
			res.Truncated = pushTopEntry(filesHeap, entry, maxEntries) || res.Truncated

			if entry.Size >= largeThreshold {
				res.LargeTruncated = pushTopEntry(largeHeap, entry, largeLimit) || res.LargeTruncated
			}

			dirBucket := bucketDirectory(root, entry.Path)
			if dirBucket != "" {
				if _, ok := dirStats[dirBucket]; !ok {
					dirStats[dirBucket] = &summaryStat{}
				}
				dirStats[dirBucket].fileCount++
				dirStats[dirBucket].totalSize += entry.Size
			}

			typeKey := strings.ToLower(strings.TrimSpace(entry.Type))
			if typeKey == "" {
				typeKey = "none"
			}
			if _, ok := typeStats[typeKey]; !ok {
				typeStats[typeKey] = &summaryStat{}
			}
			typeStats[typeKey].fileCount++
			typeStats[typeKey].totalSize += entry.Size

			return nil
		})
		if errors.Is(walkErr, context.Canceled) {
			res.Cancelled = true
			break
		}
		appendErr(walkErr)
	}

	res.Files = heapToDesc(filesHeap)
	res.LargeFiles = heapToDesc(largeHeap)

	ratioBase := res.MatchedTotalBytes
	if ratioBase == 0 {
		ratioBase = res.TotalBytes
	}
	if ratioBase > 0 {
		total := float64(ratioBase)
		for i := range res.Files {
			res.Files[i].SizeRatio = float64(res.Files[i].Size) * 100 / total
		}
		for i := range res.LargeFiles {
			res.LargeFiles[i].SizeRatio = float64(res.LargeFiles[i].Size) * 100 / total
		}
	}

	res.DirectorySummary = buildDirectorySummary(dirStats, res.MatchedTotalBytes, summaryLimit)
	res.TypeSummary = buildTypeSummary(typeStats, res.MatchedTotalBytes, summaryLimit)

	if len(errs) > 0 {
		res.Errors = errs
	}
	if res.Cancelled {
		res.Errors = appendLimit(res.Errors, "scan cancelled", 18)
	}
	res.DurationMS = time.Since(start).Milliseconds()
	return res
}

func bucketDirectory(root string, filePath string) string {
	root = filepath.Clean(strings.TrimSpace(root))
	dir := filepath.Clean(filepath.Dir(strings.TrimSpace(filePath)))
	if root == "" || dir == "" {
		return dir
	}
	rel, err := filepath.Rel(root, dir)
	if err != nil {
		return dir
	}
	rel = strings.TrimSpace(rel)
	if rel == "." || rel == "" {
		return root
	}
	parts := strings.Split(rel, string(filepath.Separator))
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part == "" || part == "." {
			continue
		}
		return filepath.Join(root, part)
	}
	return root
}

func buildDirectorySummary(stats map[string]*summaryStat, total uint64, limit int) []DirectorySummary {
	if len(stats) == 0 {
		return []DirectorySummary{}
	}
	out := make([]DirectorySummary, 0, len(stats))
	for path, item := range stats {
		if item == nil || item.fileCount <= 0 {
			continue
		}
		out = append(out, DirectorySummary{
			Path:      path,
			FileCount: item.fileCount,
			Size:      item.totalSize,
		})
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Size == out[j].Size {
			return out[i].Path < out[j].Path
		}
		return out[i].Size > out[j].Size
	})
	if limit > 0 && len(out) > limit {
		out = out[:limit]
	}
	if total > 0 {
		base := float64(total)
		for i := range out {
			out[i].SizeRatio = float64(out[i].Size) * 100 / base
		}
	}
	return out
}

func buildTypeSummary(stats map[string]*summaryStat, total uint64, limit int) []TypeSummary {
	if len(stats) == 0 {
		return []TypeSummary{}
	}
	out := make([]TypeSummary, 0, len(stats))
	for fileType, item := range stats {
		if item == nil || item.fileCount <= 0 {
			continue
		}
		out = append(out, TypeSummary{
			Type:      fileType,
			FileCount: item.fileCount,
			Size:      item.totalSize,
		})
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Size == out[j].Size {
			return out[i].Type < out[j].Type
		}
		return out[i].Size > out[j].Size
	})
	if limit > 0 && len(out) > limit {
		out = out[:limit]
	}
	if total > 0 {
		base := float64(total)
		for i := range out {
			out[i].SizeRatio = float64(out[i].Size) * 100 / base
		}
	}
	return out
}

func BuildGarbageTargets(baseDir string) []GarbageTarget {
	base := strings.TrimSpace(baseDir)
	if base == "" {
		base = "."
	}
	if !filepath.IsAbs(base) {
		if abs, err := filepath.Abs(base); err == nil {
			base = abs
		}
	}
	base = filepath.Clean(base)

	candidates := []GarbageTarget{
		{
			ID:          "app-logs",
			Name:        "Application Logs",
			Path:        filepath.Join(base, "logs"),
			Description: "Clean old logs and compressed logs, keep latest 7 days.",
			KeepHours:   24 * 7,
			Patterns:    []string{"*.log", "*.log.*", "*.trace", "*.gz", "*.old"},
			Enabled:     true,
		},
		{
			ID:          "app-cache",
			Name:        "Application Cache",
			Path:        filepath.Join(base, "cache"),
			Description: "Clean temporary cache files, keep latest 24 hours.",
			KeepHours:   24,
			Patterns:    []string{"*.tmp", "*.temp", "*.cache", "*.old", "*.bak", "*.dmp"},
			Enabled:     true,
		},
		{
			ID:          "app-temp",
			Name:        "Application Temp",
			Path:        filepath.Join(base, "tmp"),
			Description: "Clean temporary files, keep latest 24 hours.",
			KeepHours:   24,
			Patterns:    []string{"*.tmp", "*.temp", "*.cache", "*.old", "*.bak", "*.dmp"},
			Enabled:     true,
		},
	}

	switch runtime.GOOS {
	case "windows":
		tempDir := strings.TrimSpace(os.TempDir())
		if tempDir != "" {
			candidates = append(candidates, GarbageTarget{
				ID:          "sys-temp-user",
				Name:        "User Temp",
				Path:        tempDir,
				Description: "Clean user temp files, keep latest 72 hours.",
				KeepHours:   72,
				Patterns:    nil,
				Enabled:     true,
			})
		}
		winDir := strings.TrimSpace(os.Getenv("WINDIR"))
		if winDir != "" {
			candidates = append(candidates, GarbageTarget{
				ID:          "sys-temp-windows",
				Name:        "Windows Temp",
				Path:        filepath.Join(winDir, "Temp"),
				Description: "Clean Windows temp files, keep latest 72 hours.",
				KeepHours:   72,
				Patterns:    nil,
				Enabled:     false,
			})
		}
	default:
		candidates = append(candidates,
			GarbageTarget{
				ID:          "sys-tmp",
				Name:        "System Temp /tmp",
				Path:        "/tmp",
				Description: "Clean old temporary files in /tmp, keep latest 72 hours.",
				KeepHours:   72,
				Patterns:    nil,
				Enabled:     true,
			},
			GarbageTarget{
				ID:          "sys-var-tmp",
				Name:        "System Temp /var/tmp",
				Path:        "/var/tmp",
				Description: "Clean old temporary files in /var/tmp, keep latest 72 hours.",
				KeepHours:   72,
				Patterns:    nil,
				Enabled:     false,
			},
		)
	}

	out := make([]GarbageTarget, 0, len(candidates))
	pathSeen := map[string]struct{}{}
	idSeen := map[string]struct{}{}
	for _, item := range candidates {
		item.Path = filepath.Clean(strings.TrimSpace(item.Path))
		if item.Path == "" {
			continue
		}
		if !filepath.IsAbs(item.Path) {
			if abs, err := filepath.Abs(item.Path); err == nil {
				item.Path = abs
			}
		}
		if _, ok := idSeen[item.ID]; ok {
			continue
		}
		key := pathKey(item.Path)
		if _, ok := pathSeen[key]; ok {
			continue
		}
		idSeen[item.ID] = struct{}{}
		pathSeen[key] = struct{}{}
		item.Exists = isDir(item.Path)
		out = append(out, item)
	}
	return out
}
func RunGarbageCleanup(opts GarbageOptions) (GarbageResult, error) {
	ctx := opts.Context
	if ctx == nil {
		ctx = context.Background()
	}

	limit := clampInt(opts.CandidateLimit, DefaultGarbageCandidateLimit, MaxGarbageCandidateLimit)
	result := GarbageResult{
		DryRun:             opts.DryRun,
		RequestedTargetIDs: append([]string(nil), opts.TargetIDs...),
		At:                 time.Now(),
		Targets:            []GarbageTargetResult{},
	}

	targets := BuildGarbageTargets(opts.BaseDir)
	if len(targets) == 0 {
		return result, errors.New("no cleanup targets found")
	}

	selected := make([]GarbageTarget, 0, len(targets))
	idFilter := map[string]struct{}{}
	for _, id := range opts.TargetIDs {
		id = strings.TrimSpace(id)
		if id == "" {
			continue
		}
		idFilter[id] = struct{}{}
	}
	if len(idFilter) == 0 {
		for _, item := range targets {
			if item.Enabled {
				selected = append(selected, item)
			}
		}
	} else {
		for _, item := range targets {
			if _, ok := idFilter[item.ID]; ok {
				selected = append(selected, item)
			}
		}
	}
	if len(selected) == 0 {
		return result, errors.New("no cleanup target selected")
	}

	for _, target := range selected {
		if errors.Is(ctx.Err(), context.Canceled) {
			result.Cancelled = true
			break
		}

		targetRes := GarbageTargetResult{
			ID:   target.ID,
			Name: target.Name,
			Path: target.Path,
		}
		if !target.Exists {
			targetRes.Errors = []string{"target directory not found or inaccessible"}
			result.Targets = append(result.Targets, targetRes)
			continue
		}

		candidates, totalCandidates, candidateBytes, truncated, scanErrs, cancelled := collectTargetCandidates(ctx, target, limit)
		targetRes.CandidateFiles = totalCandidates
		targetRes.CandidateBytes = candidateBytes
		targetRes.Truncated = truncated
		targetRes.Samples = append(targetRes.Samples, candidates...)
		targetRes.Errors = append(targetRes.Errors, scanErrs...)
		if cancelled {
			result.Cancelled = true
		}

		result.TotalCandidateFiles += totalCandidates
		result.TotalCandidateBytes += candidateBytes

		if opts.DryRun || result.Cancelled {
			result.Targets = append(result.Targets, targetRes)
			if result.Cancelled {
				break
			}
			continue
		}

		for _, file := range candidates {
			if errors.Is(ctx.Err(), context.Canceled) {
				result.Cancelled = true
				targetRes.Errors = appendLimit(targetRes.Errors, "cleanup stopped", 20)
				break
			}

			if !pathWithinRoot(target.Path, file.Path) {
				targetRes.FailedFiles++
				targetRes.Errors = appendLimit(targetRes.Errors, "skip out-of-root path: "+file.Path, 20)
				continue
			}
			if err := os.Remove(file.Path); err != nil {
				targetRes.FailedFiles++
				targetRes.Errors = appendLimit(targetRes.Errors, err.Error(), 20)
				continue
			}
			targetRes.DeletedFiles++
			targetRes.DeletedBytes += file.Size
		}
		result.TotalDeletedFiles += targetRes.DeletedFiles
		result.TotalDeletedBytes += targetRes.DeletedBytes
		result.TotalFailedFiles += targetRes.FailedFiles
		result.Targets = append(result.Targets, targetRes)
		if result.Cancelled {
			break
		}
	}

	if result.Cancelled {
		for i := range result.Targets {
			result.Targets[i].Errors = appendLimit(result.Targets[i].Errors, "cleanup stopped", 20)
		}
	}
	return result, nil
}
func collectTargetCandidates(ctx context.Context, target GarbageTarget, limit int) ([]FileEntry, int, uint64, bool, []string, bool) {
	if ctx == nil {
		ctx = context.Background()
	}

	filesHeap := &fileMinHeap{}
	heap.Init(filesHeap)

	totalCandidates := 0
	totalBytes := uint64(0)
	truncated := false
	cancelled := false
	errs := make([]string, 0, 8)
	now := time.Now()
	keepDuration := time.Duration(maxInt(target.KeepHours, 0)) * time.Hour

	walkErr := filepath.WalkDir(target.Path, func(path string, d os.DirEntry, err error) error {
		if errors.Is(ctx.Err(), context.Canceled) {
			cancelled = true
			return ctx.Err()
		}
		if err != nil {
			if errors.Is(err, context.Canceled) {
				cancelled = true
				return err
			}
			errs = appendLimit(errs, err.Error(), 16)
			if d != nil && d.IsDir() {
				return filepath.SkipDir
			}
			return nil
		}
		if d == nil {
			return nil
		}
		if d.Type()&os.ModeSymlink != 0 {
			if d.IsDir() {
				return filepath.SkipDir
			}
			return nil
		}
		if d.IsDir() {
			return nil
		}
		info, statErr := d.Info()
		if statErr != nil {
			errs = appendLimit(errs, statErr.Error(), 16)
			return nil
		}
		if !info.Mode().IsRegular() {
			return nil
		}
		if keepDuration > 0 && now.Sub(info.ModTime()) < keepDuration {
			return nil
		}
		name := info.Name()
		if isProtectedFile(name) {
			return nil
		}
		if !matchAnyPattern(name, target.Patterns) {
			return nil
		}
		if !pathWithinRoot(target.Path, path) {
			return nil
		}

		size := info.Size()
		if size < 0 {
			size = 0
		}
		item := FileEntry{
			Path:    path,
			Name:    name,
			Type:    fileType(name),
			Size:    uint64(size),
			ModTime: info.ModTime(),
		}
		totalCandidates++
		totalBytes += item.Size
		truncated = pushTopEntry(filesHeap, item, limit) || truncated
		return nil
	})
	if walkErr != nil && !errors.Is(walkErr, context.Canceled) {
		errs = appendLimit(errs, walkErr.Error(), 16)
	}
	if errors.Is(ctx.Err(), context.Canceled) || errors.Is(walkErr, context.Canceled) {
		cancelled = true
	}

	out := heapToDesc(filesHeap)
	if totalBytes > 0 {
		total := float64(totalBytes)
		for i := range out {
			out[i].SizeRatio = float64(out[i].Size) * 100 / total
		}
	}
	if cancelled {
		errs = appendLimit(errs, "cleanup stopped", 16)
	}
	return out, totalCandidates, totalBytes, truncated, errs, cancelled
}
func pathWithinRoot(root string, path string) bool {
	rel, err := filepath.Rel(root, path)
	if err != nil {
		return false
	}
	rel = strings.TrimSpace(rel)
	if rel == "." {
		return true
	}
	return rel != ".." && !strings.HasPrefix(rel, ".."+string(filepath.Separator))
}

func matchAnyPattern(name string, patterns []string) bool {
	if len(patterns) == 0 {
		return true
	}
	nameLower := strings.ToLower(strings.TrimSpace(name))
	for _, raw := range patterns {
		p := strings.ToLower(strings.TrimSpace(raw))
		if p == "" {
			continue
		}
		if ok, _ := filepath.Match(p, nameLower); ok {
			return true
		}
		if strings.HasPrefix(p, ".") && strings.HasSuffix(nameLower, p) {
			return true
		}
		if strings.Contains(nameLower, p) {
			return true
		}
	}
	return false
}

func isProtectedFile(name string) bool {
	ext := strings.ToLower(strings.TrimSpace(filepath.Ext(name)))
	if ext == "" {
		return false
	}
	protected := map[string]struct{}{
		".sys": {}, ".dll": {}, ".drv": {}, ".efi": {}, ".ko": {}, ".so": {}, ".dylib": {},
		".exe": {}, ".com": {}, ".msi": {}, ".pkg": {}, ".deb": {}, ".rpm": {},
	}
	_, ok := protected[ext]
	return ok
}

func fileType(name string) string {
	ext := strings.ToLower(strings.TrimSpace(filepath.Ext(name)))
	if ext == "" {
		return "none"
	}
	return strings.TrimPrefix(ext, ".")
}
func fuzzyMatch(item FileEntry, query string) bool {
	q := strings.ToLower(strings.TrimSpace(query))
	if q == "" {
		return true
	}
	if strings.Contains(strings.ToLower(item.Path), q) {
		return true
	}
	if strings.Contains(strings.ToLower(item.Name), q) {
		return true
	}
	if strings.Contains(strings.ToLower(item.Type), q) {
		return true
	}
	return false
}

func pathKey(p string) string {
	if runtime.GOOS == "windows" {
		return strings.ToLower(strings.TrimSpace(p))
	}
	return strings.TrimSpace(p)
}

func isDir(path string) bool {
	info, err := os.Stat(path)
	if err != nil {
		return false
	}
	return info.IsDir()
}

func clampInt(v int, def int, max int) int {
	if v <= 0 {
		v = def
	}
	if v > max {
		return max
	}
	return v
}

func maxInt(a int, b int) int {
	if a > b {
		return a
	}
	return b
}

func appendLimit(items []string, item string, limit int) []string {
	item = strings.TrimSpace(item)
	if item == "" {
		return items
	}
	for _, v := range items {
		if v == item {
			return items
		}
	}
	if len(items) >= limit {
		return items
	}
	return append(items, item)
}

type fileMinHeap []FileEntry

func (h fileMinHeap) Len() int { return len(h) }

func (h fileMinHeap) Less(i, j int) bool {
	if h[i].Size == h[j].Size {
		return h[i].Path > h[j].Path
	}
	return h[i].Size < h[j].Size
}

func (h fileMinHeap) Swap(i, j int) { h[i], h[j] = h[j], h[i] }

func (h *fileMinHeap) Push(x any) { *h = append(*h, x.(FileEntry)) }

func (h *fileMinHeap) Pop() any {
	old := *h
	n := len(old)
	item := old[n-1]
	*h = old[:n-1]
	return item
}

func pushTopEntry(h *fileMinHeap, item FileEntry, limit int) bool {
	if limit <= 0 {
		heap.Push(h, item)
		return false
	}
	if h.Len() < limit {
		heap.Push(h, item)
		return false
	}
	minItem := (*h)[0]
	if item.Size > minItem.Size || (item.Size == minItem.Size && item.Path < minItem.Path) {
		heap.Pop(h)
		heap.Push(h, item)
	}
	return true
}

func heapToDesc(h *fileMinHeap) []FileEntry {
	n := h.Len()
	out := make([]FileEntry, n)
	for i := n - 1; i >= 0; i-- {
		out[i] = heap.Pop(h).(FileEntry)
	}
	return out
}
