package systemlog

import (
	"bufio"
	"io"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

type Entry struct {
	Time   time.Time `json:"time"`
	Level  string    `json:"level"`
	Source string    `json:"source"`
	Text   string    `json:"text"`
}

type Center struct {
	mu         sync.RWMutex
	entries    []Entry
	maxEntries int
	file       *os.File
	writer     *lineWriter
}

type lineWriter struct {
	center *Center
	mu     sync.Mutex
	buf    string
}

var global = New(3000)

func New(maxEntries int) *Center {
	if maxEntries <= 0 {
		maxEntries = 3000
	}
	c := &Center{maxEntries: maxEntries}
	c.writer = &lineWriter{center: c}
	return c
}

func Global() *Center {
	return global
}

func Configure(filePath string, maxEntries int) error {
	if maxEntries > 0 {
		global.mu.Lock()
		global.maxEntries = maxEntries
		global.mu.Unlock()
	}
	return global.configureFile(filePath)
}

func Writer() io.Writer {
	return global.writer
}

func List(limit int, keyword, level string) []Entry {
	return global.list(limit, keyword, level)
}

func Add(level, source, text string) {
	global.add(level, source, text)
}

func (c *Center) configureFile(filePath string) error {
	filePath = strings.TrimSpace(filePath)
	if filePath == "" {
		return nil
	}
	if err := os.MkdirAll(filepath.Dir(filePath), 0o755); err != nil {
		return err
	}
	f, err := os.OpenFile(filePath, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
	if err != nil {
		return err
	}

	c.mu.Lock()
	old := c.file
	c.file = f
	c.mu.Unlock()

	if old != nil {
		_ = old.Close()
	}
	return nil
}

func (c *Center) list(limit int, keyword, level string) []Entry {
	keyword = strings.ToLower(strings.TrimSpace(keyword))
	level = strings.ToLower(strings.TrimSpace(level))
	c.mu.RLock()
	defer c.mu.RUnlock()

	if limit <= 0 {
		limit = 200
	}
	out := make([]Entry, 0, min(limit, len(c.entries)))
	for i := len(c.entries) - 1; i >= 0; i-- {
		item := c.entries[i]
		if level != "" && level != "all" && strings.ToLower(item.Level) != level {
			continue
		}
		if keyword != "" {
			text := strings.ToLower(item.Text + " " + item.Source + " " + item.Level)
			if !strings.Contains(text, keyword) {
				continue
			}
		}
		out = append(out, item)
		if len(out) >= limit {
			break
		}
	}
	return out
}

func (c *Center) add(level, source, text string) {
	text = strings.TrimSpace(text)
	if text == "" {
		return
	}
	entry := Entry{
		Time:   time.Now(),
		Level:  normalizeLevel(level, text),
		Source: nonEmpty(source, "runtime"),
		Text:   text,
	}

	c.mu.Lock()
	c.entries = append(c.entries, entry)
	if len(c.entries) > c.maxEntries {
		c.entries = append([]Entry(nil), c.entries[len(c.entries)-c.maxEntries:]...)
	}
	file := c.file
	c.mu.Unlock()

	if file != nil {
		_, _ = io.WriteString(file, entry.Time.Format(time.RFC3339)+" ["+entry.Level+"] "+entry.Text+"\n")
	}
}

func (w *lineWriter) Write(p []byte) (int, error) {
	w.mu.Lock()
	defer w.mu.Unlock()

	text := w.buf + string(p)
	scanner := bufio.NewScanner(strings.NewReader(text))
	lines := make([]string, 0, 8)
	for scanner.Scan() {
		lines = append(lines, scanner.Text())
	}
	if strings.HasSuffix(text, "\n") || strings.HasSuffix(text, "\r") {
		w.buf = ""
	} else {
		last := ""
		if len(lines) > 0 {
			last = lines[len(lines)-1]
			lines = lines[:len(lines)-1]
		}
		w.buf = last
	}
	for _, line := range lines {
		w.center.add("", "runtime", line)
	}
	return len(p), nil
}

func normalizeLevel(level, text string) string {
	level = strings.ToLower(strings.TrimSpace(level))
	if level != "" {
		return level
	}
	low := strings.ToLower(strings.TrimSpace(text))
	switch {
	case strings.Contains(low, " fatal "), strings.Contains(low, "panic"), strings.Contains(low, "error"):
		return "error"
	case strings.Contains(low, "warn"):
		return "warn"
	case strings.Contains(low, "debug"):
		return "debug"
	default:
		return "info"
	}
}

func nonEmpty(value, fallback string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return fallback
	}
	return value
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
