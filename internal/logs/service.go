package logs

import (
	"archive/zip"
	"bufio"
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"sort"
	"strconv"
	"strings"
	"time"

	"ops-tool/internal/config"
)

type Entry struct {
	Time    time.Time `json:"time"`
	Level   string    `json:"level"`
	App     string    `json:"app"`
	File    string    `json:"file"`
	Message string    `json:"message"`
	Raw     string    `json:"raw"`
}

type Query struct {
	Keyword string
	Level   string
	Limit   int
	Rule    string
}

var (
	reTimestamp = regexp.MustCompile(`\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}`)
)

func SearchAppLogs(app config.Application, rules []config.LogRule, q Query) ([]Entry, error) {
	if strings.EqualFold(strings.TrimSpace(app.Type), "windows-eventlog") {
		return searchWindowsEventLogs(app, rules, q)
	}
	if len(app.LogFiles) == 0 {
		return nil, nil
	}
	if q.Limit <= 0 {
		q.Limit = 300
	}

	rulePattern := ""
	if q.Rule != "" {
		for _, r := range rules {
			if r.Name == q.Rule {
				rulePattern = r.Pattern
				break
			}
		}
		if rulePattern == "" {
			return nil, fmt.Errorf("rule not found: %s", q.Rule)
		}
	}

	entries := make([]Entry, 0, q.Limit)
	for _, f := range app.LogFiles {
		items, err := readLogFile(app.Name, f, q, rulePattern)
		if err != nil {
			continue
		}
		entries = append(entries, items...)
	}

	sort.SliceStable(entries, func(i, j int) bool {
		return entries[i].Time.After(entries[j].Time)
	})
	if len(entries) > q.Limit {
		entries = entries[:q.Limit]
	}
	return entries, nil
}

func searchWindowsEventLogs(app config.Application, rules []config.LogRule, q Query) ([]Entry, error) {
	if runtime.GOOS != "windows" {
		return nil, nil
	}
	if q.Limit <= 0 {
		q.Limit = 300
	}
	channels := normalizeWindowsChannels(app.LogFiles)
	if len(channels) == 0 {
		channels = []string{"System"}
	}

	rulePattern := ""
	if q.Rule != "" {
		for _, r := range rules {
			if r.Name == q.Rule {
				rulePattern = r.Pattern
				break
			}
		}
		if rulePattern == "" {
			return nil, fmt.Errorf("rule not found: %s", q.Rule)
		}
	}
	var reRule *regexp.Regexp
	var err error
	if rulePattern != "" {
		reRule, err = regexp.Compile(rulePattern)
		if err != nil {
			return nil, errors.New("invalid rule regex")
		}
	}

	maxEvents := minInt(maxInt(q.Limit*2, 200), 2000)
	records, err := queryWindowsEventLog(channels, maxEvents)
	if err != nil {
		return nil, err
	}

	out := make([]Entry, 0, q.Limit)
	for _, row := range records {
		message := sanitizeWindowsMessage(row.Message)
		level := normalizeWindowsLevel(row.LevelDisplayName, message)
		combined := level + " " + message
		if q.Keyword != "" && !strings.Contains(strings.ToLower(combined), strings.ToLower(q.Keyword)) {
			continue
		}
		if !matchLevel(combined, q.Level) {
			continue
		}
		if reRule != nil && !reRule.MatchString(combined) {
			continue
		}
		t := parseWindowsEventTime(row.TimeCreated)
		if t.IsZero() {
			t = time.Now()
		}
		out = append(out, Entry{
			Time:    t,
			Level:   level,
			App:     app.Name,
			File:    nonEmpty(strings.TrimSpace(row.LogName), "WindowsEventLog"),
			Message: message,
			Raw:     message,
		})
	}
	sort.SliceStable(out, func(i, j int) bool {
		return out[i].Time.After(out[j].Time)
	})
	if len(out) > q.Limit {
		out = out[:q.Limit]
	}
	return out, nil
}

func readLogFile(appName, path string, q Query, rulePattern string) ([]Entry, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	var (
		reRule *regexp.Regexp
	)
	if rulePattern != "" {
		reRule, err = regexp.Compile(rulePattern)
		if err != nil {
			return nil, errors.New("invalid rule regex")
		}
	}

	scanner := bufio.NewScanner(f)
	buf := make([]byte, 0, 1024*64)
	scanner.Buffer(buf, 1024*1024)

	items := make([]Entry, 0, 128)
	for scanner.Scan() {
		line := scanner.Text()
		if !matchLevel(line, q.Level) {
			continue
		}
		if q.Keyword != "" && !strings.Contains(strings.ToLower(line), strings.ToLower(q.Keyword)) {
			continue
		}
		if reRule != nil && !reRule.MatchString(line) {
			continue
		}
		e := Entry{
			Time:    parseLogTime(line),
			Level:   detectLevel(line),
			App:     appName,
			File:    path,
			Message: line,
			Raw:     line,
		}
		items = append(items, e)
	}
	return items, scanner.Err()
}

func matchLevel(line, level string) bool {
	if level == "" || strings.EqualFold(level, "all") {
		return true
	}
	l := strings.ToLower(line)
	switch strings.ToLower(level) {
	case "error":
		return strings.Contains(l, "error") || strings.Contains(l, "fatal") || strings.Contains(l, "panic")
	case "info":
		return strings.Contains(l, "info")
	default:
		return strings.Contains(l, strings.ToLower(level))
	}
}

func detectLevel(line string) string {
	l := strings.ToLower(line)
	switch {
	case strings.Contains(l, "error"), strings.Contains(l, "fatal"), strings.Contains(l, "panic"):
		return "error"
	case strings.Contains(l, "warn"):
		return "warn"
	case strings.Contains(l, "debug"):
		return "debug"
	default:
		return "info"
	}
}

func parseLogTime(line string) time.Time {
	ts := reTimestamp.FindString(line)
	if ts == "" {
		return time.Now()
	}
	layouts := []string{
		"2006-01-02 15:04:05",
		"2006-01-02T15:04:05",
	}
	for _, layout := range layouts {
		if t, err := time.ParseInLocation(layout, ts, time.Local); err == nil {
			return t
		}
	}
	return time.Now()
}

func ExportAppLogs(app config.Application, selectedFiles []string, outPath string) (string, error) {
	if strings.EqualFold(strings.TrimSpace(app.Type), "windows-eventlog") {
		return exportWindowsEventLogs(app, selectedFiles, outPath)
	}
	if len(selectedFiles) == 0 {
		selectedFiles = app.LogFiles
	}
	if len(selectedFiles) == 0 {
		return "", errors.New("no log file selected")
	}
	if err := os.MkdirAll(filepath.Dir(outPath), 0o755); err != nil {
		return "", err
	}

	dst, err := os.Create(outPath)
	if err != nil {
		return "", err
	}
	defer dst.Close()

	zw := zip.NewWriter(dst)
	for _, file := range selectedFiles {
		if err := addFileToZip(zw, file); err != nil {
			continue
		}
	}
	if err := zw.Close(); err != nil {
		return "", err
	}
	return outPath, nil
}

func addFileToZip(zw *zip.Writer, src string) error {
	f, err := os.Open(src)
	if err != nil {
		return err
	}
	defer f.Close()

	info, err := f.Stat()
	if err != nil {
		return err
	}
	hdr, err := zip.FileInfoHeader(info)
	if err != nil {
		return err
	}
	hdr.Name = filepath.Base(src)
	w, err := zw.CreateHeader(hdr)
	if err != nil {
		return err
	}
	_, err = io.Copy(w, f)
	return err
}

type windowsEventRow struct {
	TimeCreated      string `json:"TimeCreated"`
	LevelDisplayName string `json:"LevelDisplayName"`
	Message          string `json:"Message"`
	LogName          string `json:"LogName"`
}

func queryWindowsEventLog(channels []string, maxEvents int) ([]windowsEventRow, error) {
	if runtime.GOOS != "windows" {
		return nil, nil
	}
	if len(channels) == 0 {
		return nil, nil
	}
	if maxEvents <= 0 {
		maxEvents = 200
	}

	quoted := make([]string, 0, len(channels))
	for _, c := range channels {
		c = strings.TrimSpace(c)
		if c == "" {
			continue
		}
		quoted = append(quoted, "'"+strings.ReplaceAll(c, "'", "''")+"'")
	}
	if len(quoted) == 0 {
		return nil, nil
	}

	script := "$ErrorActionPreference='SilentlyContinue'; " +
		"$names=@(" + strings.Join(quoted, ",") + "); " +
		"$max=" + strconv.Itoa(maxEvents) + "; " +
		"$result=@(); " +
		"foreach($n in $names){ " +
		"try { $result += Get-WinEvent -LogName $n -MaxEvents $max | Select-Object TimeCreated,LevelDisplayName,Message,LogName } catch {} " +
		"}; " +
		"$result | ConvertTo-Json -Compress -Depth 5"
	cmd := exec.Command("powershell", "-NoProfile", "-Command", "[Console]::OutputEncoding=[System.Text.Encoding]::UTF8; "+script)
	raw, err := cmd.Output()
	if err != nil {
		return nil, err
	}
	return decodeWindowsEventJSON(raw)
}

func decodeWindowsEventJSON(raw []byte) ([]windowsEventRow, error) {
	b := bytes.TrimSpace(raw)
	if len(b) == 0 || bytes.EqualFold(b, []byte("null")) {
		return nil, nil
	}
	if b[0] == '[' {
		var out []windowsEventRow
		if err := json.Unmarshal(b, &out); err != nil {
			return nil, err
		}
		return out, nil
	}
	var one windowsEventRow
	if err := json.Unmarshal(b, &one); err != nil {
		return nil, err
	}
	return []windowsEventRow{one}, nil
}

func normalizeWindowsChannels(channels []string) []string {
	out := make([]string, 0, len(channels))
	seen := map[string]struct{}{}
	for _, c := range channels {
		c = strings.TrimSpace(c)
		if c == "" {
			continue
		}
		key := strings.ToLower(c)
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		out = append(out, c)
	}
	return out
}

func sanitizeWindowsMessage(raw string) string {
	text := strings.ReplaceAll(raw, "\r\n", " ")
	text = strings.ReplaceAll(text, "\n", " ")
	text = strings.Join(strings.Fields(text), " ")
	return strings.TrimSpace(text)
}

func parseWindowsEventTime(raw string) time.Time {
	v := strings.TrimSpace(raw)
	if v == "" {
		return time.Time{}
	}
	if strings.HasPrefix(v, "/Date(") && strings.Contains(v, ")/") {
		inner := strings.TrimPrefix(v, "/Date(")
		inner = strings.TrimSuffix(inner, ")/")
		inner = strings.TrimSuffix(inner, "/")
		if idx := strings.IndexAny(inner, "+-"); idx > 0 {
			inner = inner[:idx]
		}
		if ms, err := strconv.ParseInt(inner, 10, 64); err == nil {
			return time.UnixMilli(ms)
		}
	}
	layouts := []string{
		time.RFC3339Nano,
		time.RFC3339,
		"2006-01-02 15:04:05",
		"2006-01-02T15:04:05",
	}
	for _, layout := range layouts {
		if t, err := time.ParseInLocation(layout, v, time.Local); err == nil {
			return t
		}
	}
	return time.Time{}
}

func normalizeWindowsLevel(level, line string) string {
	l := strings.ToLower(strings.TrimSpace(level))
	switch {
	case strings.Contains(l, "error"), strings.Contains(l, "critical"), strings.Contains(l, "fatal"):
		return "error"
	case strings.Contains(l, "warn"):
		return "warn"
	case strings.Contains(l, "debug"), strings.Contains(l, "verbose"):
		return "debug"
	case l != "":
		return "info"
	default:
		return detectLevel(line)
	}
}

func exportWindowsEventLogs(app config.Application, selectedChannels []string, outPath string) (string, error) {
	if runtime.GOOS != "windows" {
		return "", errors.New("windows event log export only supported on windows")
	}
	if len(selectedChannels) == 0 {
		selectedChannels = app.LogFiles
	}
	channels := normalizeWindowsChannels(selectedChannels)
	if len(channels) == 0 {
		return "", errors.New("no event log channel selected")
	}
	if err := os.MkdirAll(filepath.Dir(outPath), 0o755); err != nil {
		return "", err
	}

	dst, err := os.Create(outPath)
	if err != nil {
		return "", err
	}
	defer dst.Close()

	zw := zip.NewWriter(dst)
	defer zw.Close()

	for _, ch := range channels {
		rows, err := queryWindowsEventLog([]string{ch}, 2000)
		if err != nil {
			continue
		}
		name := sanitizeZipName(ch) + ".log"
		w, err := zw.Create(name)
		if err != nil {
			continue
		}
		if len(rows) == 0 {
			_, _ = io.WriteString(w, "no events\n")
			continue
		}
		sort.SliceStable(rows, func(i, j int) bool {
			ti := parseWindowsEventTime(rows[i].TimeCreated)
			tj := parseWindowsEventTime(rows[j].TimeCreated)
			return ti.After(tj)
		})
		for _, row := range rows {
			t := parseWindowsEventTime(row.TimeCreated)
			if t.IsZero() {
				t = time.Now()
			}
			line := fmt.Sprintf("[%s] [%s] [%s] %s\n",
				t.Format("2006-01-02 15:04:05"),
				normalizeWindowsLevel(row.LevelDisplayName, row.Message),
				nonEmpty(strings.TrimSpace(row.LogName), ch),
				sanitizeWindowsMessage(row.Message),
			)
			_, _ = io.WriteString(w, line)
		}
	}
	if err := zw.Close(); err != nil {
		return "", err
	}
	return outPath, nil
}

func sanitizeZipName(raw string) string {
	name := strings.TrimSpace(raw)
	if name == "" {
		return "eventlog"
	}
	replacer := strings.NewReplacer("\\", "_", "/", "_", ":", "_", "*", "_", "?", "_", "\"", "_", "<", "_", ">", "_", "|", "_")
	name = replacer.Replace(name)
	return strings.TrimSpace(name)
}

func nonEmpty(items ...string) string {
	for _, item := range items {
		if strings.TrimSpace(item) != "" {
			return strings.TrimSpace(item)
		}
	}
	return ""
}

func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}
