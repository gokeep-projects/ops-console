package filesystem

import (
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
)

type TreeNode struct {
	Name         string `json:"name"`
	Path         string `json:"path"`
	Type         string `json:"type"`
	HasChildren  bool   `json:"has_children"`
	Readable     bool   `json:"readable"`
	ChildrenHint int    `json:"children_hint"`
}

func Roots() []TreeNode {
	roots := make([]TreeNode, 0, 8)
	for _, root := range rootPaths() {
		name := root
		if runtime.GOOS == "windows" {
			name = strings.TrimSuffix(strings.TrimSuffix(root, `\`), "/")
		}
		roots = append(roots, TreeNode{
			Name:        name,
			Path:        root,
			Type:        "directory",
			HasChildren: true,
			Readable:    true,
		})
	}
	return roots
}

func ListDirectory(path string, limit int) ([]TreeNode, error) {
	path = strings.TrimSpace(path)
	if path == "" {
		return Roots(), nil
	}
	if !filepath.IsAbs(path) {
		abs, err := filepath.Abs(path)
		if err == nil {
			path = abs
		}
	}
	info, err := os.Stat(path)
	if err != nil {
		return nil, err
	}
	if !info.IsDir() {
		path = filepath.Dir(path)
	}
	entries, err := os.ReadDir(path)
	if err != nil {
		return nil, err
	}
	if limit <= 0 {
		limit = 300
	}
	nodes := make([]TreeNode, 0, min(limit, len(entries)))
	for _, entry := range entries {
		if len(nodes) >= limit {
			break
		}
		full := filepath.Join(path, entry.Name())
		readable := true
		hasChildren := false
		childrenHint := 0
		if entry.IsDir() {
			hasChildren, childrenHint = probeChildren(full)
		}
		nodes = append(nodes, TreeNode{
			Name:         entry.Name(),
			Path:         full,
			Type:         nodeType(entry),
			HasChildren:  hasChildren,
			Readable:     readable,
			ChildrenHint: childrenHint,
		})
	}
	sort.SliceStable(nodes, func(i, j int) bool {
		if nodes[i].Type != nodes[j].Type {
			return nodes[i].Type == "directory"
		}
		return strings.ToLower(nodes[i].Name) < strings.ToLower(nodes[j].Name)
	})
	return nodes, nil
}

func CreateDirectory(path string) (string, error) {
	path = strings.TrimSpace(path)
	if path == "" {
		return "", fmt.Errorf("path is required")
	}
	if !filepath.IsAbs(path) {
		abs, err := filepath.Abs(path)
		if err == nil {
			path = abs
		}
	}
	if err := os.MkdirAll(path, 0o755); err != nil {
		return "", err
	}
	return path, nil
}

func rootPaths() []string {
	if runtime.GOOS == "windows" {
		out := make([]string, 0, 8)
		for ch := 'A'; ch <= 'Z'; ch++ {
			root := fmt.Sprintf("%c:\\", ch)
			if info, err := os.Stat(root); err == nil && info.IsDir() {
				out = append(out, root)
			}
		}
		if len(out) == 0 {
			out = append(out, `C:\`)
		}
		return out
	}
	return []string{"/"}
}

func probeChildren(path string) (bool, int) {
	entries, err := os.ReadDir(path)
	if err != nil {
		return false, 0
	}
	count := 0
	for _, entry := range entries {
		if strings.HasPrefix(entry.Name(), ".") {
			count++
		} else {
			count++
		}
		if count >= 200 {
			break
		}
	}
	return count > 0, count
}

func nodeType(entry os.DirEntry) string {
	if entry.IsDir() {
		return "directory"
	}
	return "file"
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
