package logs

import (
	"archive/zip"
	"bufio"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"runtime"
	"sort"
	"strings"
	"time"

	"ops-tool/internal/config"
)

type Query struct {
	Keyword string
	Level   string
	Limit   int
	Rule    string
}

type Item struct {
	Time    string `json:"time"`
	Level   string `json:"level"`
	File    string `json:"file"`
	Line    int    `json:"line"`
	Message string `json:"message"`
}

func SearchAppLogs(app config.Application, rules []config.LogRule, query Query) ([]Item, error) {
	if !app.Enabled {
		return nil, nil
	}
	if query.Limit <= 0 {
		query.Limit = 300
	}

	matcher, err := buildMatcher(rules, query)
	if err != nil {
		return nil, err
	}

	appType := strings.ToLower(strings.TrimSpace(app.Type))
	if appType == "windows-eventlog" && runtime.GOOS != "windows" {
		return []Item{}, nil
	}

	items := make([]Item, 0, query.Limit)
	for _, path := range app.LogFiles {
		path = strings.TrimSpace(path)
		if path == "" {
			continue
		}
		fileItems, err := searchFile(path, matcher, query.Limit)
		if err != nil {
			continue
		}
		items = append(items, fileItems...)
		if len(items) > query.Limit*4 {
			items = items[len(items)-query.Limit*4:]
		}
	}

	sort.Slice(items, func(i, j int) bool {
		return compareTime(items[i].Time, items[j].Time) < 0
	})
	if len(items) > query.Limit {
		items = items[len(items)-query.Limit:]
	}
	return items, nil
}

func ExportAppLogs(app config.Application, files []string, out string) (int, error) {
	if strings.TrimSpace(out) == "" {
		return 0, errors.New("output path is required")
	}

	selected := pickFiles(app, files)
	appType := strings.ToLower(strings.TrimSpace(app.Type))

	f, err := os.Create(out)
	if err != nil {
		return 0, err
	}
	defer f.Close()

	zw := zip.NewWriter(f)
	defer zw.Close()

	if appType == "windows-eventlog" && runtime.GOOS != "windows" {
		w, err := zw.Create("eventlog_unsupported.txt")
		if err != nil {
			return 0, err
		}
		if _, err := w.Write([]byte("windows event log export is unsupported on this platform\n")); err != nil {
			return 0, err
		}
		return 1, nil
	}

	added := 0
	seen := map[string]int{}
	for _, src := range selected {
		src = strings.TrimSpace(src)
		if src == "" {
			continue
		}
		info, err := os.Stat(src)
		if err != nil {
			continue
		}
		if info.IsDir() {
			err = filepath.Walk(src, func(path string, fi os.FileInfo, walkErr error) error {
				if walkErr != nil || fi.IsDir() {
					return walkErr
				}
				if err := addFileToZip(zw, src, path, seen); err != nil {
					return err
				}
				added++
				return nil
			})
			if err != nil {
				return added, err
			}
			continue
		}
		if err := addFileToZip(zw, filepath.Dir(src), src, seen); err != nil {
			return added, err
		}
		added++
	}

	if added == 0 {
		return 0, errors.New("no readable log files")
	}
	return added, nil
}

type matcher struct {
	keyword string
	level   string
	rule    *regexp.Regexp
}

func buildMatcher(rules []config.LogRule, query Query) (*matcher, error) {
	m := &matcher{
		keyword: strings.ToLower(strings.TrimSpace(query.Keyword)),
		level:   normalizeLevel(query.Level),
	}
	ruleName := strings.TrimSpace(query.Rule)
	if ruleName == "" {
		return m, nil
	}
	for _, item := range rules {
		if strings.TrimSpace(item.Name) != ruleName {
			continue
		}
		re, err := regexp.Compile(item.Pattern)
		if err != nil {
			return nil, fmt.Errorf("invalid log rule %q: %w", item.Name, err)
		}
		m.rule = re
		return m, nil
	}
	return nil, fmt.Errorf("log rule not found: %s", ruleName)
}

func searchFile(path string, m *matcher, limit int) ([]Item, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	items := make([]Item, 0, min(limit, 128))
	scanner := bufio.NewScanner(f)
	scanner.Buffer(make([]byte, 4096), 1024*1024)
	lineNo := 0
	for scanner.Scan() {
		lineNo++
		line := scanner.Text()
		if !m.match(line) {
			continue
		}
		item := Item{
			Time:    detectTime(line),
			Level:   detectLevel(line),
			File:    path,
			Line:    lineNo,
			Message: strings.TrimSpace(line),
		}
		items = append(items, item)
		if len(items) > limit {
			items = items[len(items)-limit:]
		}
	}
	if err := scanner.Err(); err != nil {
		return items, err
	}
	return items, nil
}

func (m *matcher) match(line string) bool {
	text := strings.TrimSpace(line)
	if text == "" {
		return false
	}
	if m.keyword != "" && !strings.Contains(strings.ToLower(text), m.keyword) {
		return false
	}
	if m.level != "" && m.level != "all" && detectLevel(text) != m.level {
		return false
	}
	if m.rule != nil && !m.rule.MatchString(text) {
		return false
	}
	return true
}

func pickFiles(app config.Application, files []string) []string {
	if len(files) == 0 {
		files = app.LogFiles
	}
	out := make([]string, 0, len(files))
	seen := make(map[string]struct{}, len(files))
	for _, item := range files {
		item = strings.TrimSpace(item)
		if item == "" {
			continue
		}
		if _, ok := seen[item]; ok {
			continue
		}
		seen[item] = struct{}{}
		out = append(out, item)
	}
	return out
}

func addFileToZip(zw *zip.Writer, base, path string, seen map[string]int) error {
	f, err := os.Open(path)
	if err != nil {
		return err
	}
	defer f.Close()

	info, err := f.Stat()
	if err != nil {
		return err
	}
	header, err := zip.FileInfoHeader(info)
	if err != nil {
		return err
	}

	name, err := filepath.Rel(base, path)
	if err != nil || strings.TrimSpace(name) == "" || name == "." {
		name = filepath.Base(path)
	}
	name = filepath.ToSlash(name)
	if idx := seen[name]; idx > 0 {
		ext := filepath.Ext(name)
		stem := strings.TrimSuffix(name, ext)
		name = fmt.Sprintf("%s_%d%s", stem, idx+1, ext)
	}
	seen[name]++
	header.Name = name

	w, err := zw.CreateHeader(header)
	if err != nil {
		return err
	}
	_, err = bufio.NewReader(f).WriteTo(w)
	return err
}

func normalizeLevel(raw string) string {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "", "all":
		return "all"
	case "error", "warn", "warning", "info", "debug":
		if raw == "warning" {
			return "warn"
		}
		return strings.ToLower(strings.TrimSpace(raw))
	default:
		return strings.ToLower(strings.TrimSpace(raw))
	}
}

func detectLevel(line string) string {
	text := strings.ToLower(line)
	switch {
	case strings.Contains(text, " panic "), strings.HasPrefix(text, "panic"), strings.Contains(text, " fatal "), strings.Contains(text, " error "):
		return "error"
	case strings.Contains(text, "[error]"), strings.Contains(text, "err="), strings.Contains(text, "exception"):
		return "error"
	case strings.Contains(text, " warn "), strings.Contains(text, "[warn]"), strings.Contains(text, " warning "):
		return "warn"
	case strings.Contains(text, " debug "), strings.Contains(text, "[debug]"), strings.Contains(text, " trace "):
		return "debug"
	case strings.Contains(text, " info "), strings.Contains(text, "[info]"):
		return "info"
	default:
		return "info"
	}
}

var timePatterns = []*regexp.Regexp{
	regexp.MustCompile(`\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?`),
	regexp.MustCompile(`[A-Z][a-z]{2}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2}`),
}

func detectTime(line string) string {
	for _, re := range timePatterns {
		if match := re.FindString(line); match != "" {
			return normalizeTime(match)
		}
	}
	return ""
}

func normalizeTime(raw string) string {
	raw = strings.TrimSpace(raw)
	layouts := []string{
		time.RFC3339,
		"2006-01-02 15:04:05",
		"2006-01-02T15:04:05",
		"2006-01-02 15:04:05.000",
		"2006-01-02T15:04:05.000",
		"Jan 2 15:04:05",
	}
	for _, layout := range layouts {
		t, err := time.Parse(layout, raw)
		if err != nil {
			continue
		}
		if layout == "Jan 2 15:04:05" {
			now := time.Now()
			t = time.Date(now.Year(), t.Month(), t.Day(), t.Hour(), t.Minute(), t.Second(), 0, now.Location())
		}
		return t.Format("2006-01-02 15:04:05")
	}
	return raw
}

func compareTime(a, b string) int {
	ta := parseTime(a)
	tb := parseTime(b)
	switch {
	case ta.Before(tb):
		return -1
	case ta.After(tb):
		return 1
	default:
		return strings.Compare(a, b)
	}
}

func parseTime(raw string) time.Time {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return time.Time{}
	}
	layouts := []string{
		"2006-01-02 15:04:05",
		time.RFC3339,
		"2006-01-02T15:04:05",
	}
	for _, layout := range layouts {
		if ts, err := time.Parse(layout, raw); err == nil {
			return ts
		}
	}
	return time.Time{}
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
