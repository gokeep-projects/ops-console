package backup

import (
	"archive/zip"
	"context"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"ops-tool/internal/config"
	"ops-tool/internal/store"
)

type Request struct {
	Type   string   `json:"type"`
	Name   string   `json:"name"`
	Paths  []string `json:"paths"`
	Target string   `json:"target"`
}

type Manager struct {
	store *store.Store
}

func NewManager(st *store.Store) *Manager {
	return &Manager{store: st}
}

func (m *Manager) Start(cfg *config.Config, req Request) (int64, string, error) {
	backupDir := cfg.Backup.StoragePath
	if req.Target != "" {
		backupDir = req.Target
	}
	if err := os.MkdirAll(backupDir, 0o755); err != nil {
		return 0, "", err
	}

	name := req.Name
	if name == "" {
		name = req.Type
	}
	fileName := fmt.Sprintf("%s_%s.zip", sanitize(name), time.Now().Format("20060102_150405"))
	outPath := filepath.Join(backupDir, fileName)

	id, err := m.store.CreateBackupRecord(req.Type, name, outPath)
	if err != nil {
		return 0, "", err
	}

	go m.runBackup(cfg, id, outPath, req)
	return id, outPath, nil
}

func (m *Manager) runBackup(cfg *config.Config, id int64, outPath string, req Request) {
	var err error
	switch strings.ToLower(req.Type) {
	case "files":
		paths := req.Paths
		if len(paths) == 0 {
			paths = cfg.Backup.Files
		}
		err = zipPaths(outPath, paths)
	case "database":
		err = backupByCommand(outPath, cfg.Backup.Databases, req.Name)
	case "es":
		err = backupByCommand(outPath, cfg.Backup.ES, req.Name)
	default:
		err = fmt.Errorf("unsupported backup type: %s", req.Type)
	}

	if err != nil {
		_ = m.store.FinishBackupRecord(id, "failed", err.Error())
		return
	}
	_ = m.store.FinishBackupRecord(id, "success", "ok")
}

func zipPaths(outPath string, paths []string) error {
	f, err := os.Create(outPath)
	if err != nil {
		return err
	}
	defer f.Close()

	zw := zip.NewWriter(f)
	for _, src := range paths {
		if err := addPath(zw, src); err != nil {
			continue
		}
	}
	return zw.Close()
}

func addPath(zw *zip.Writer, src string) error {
	info, err := os.Stat(src)
	if err != nil {
		return err
	}
	if info.IsDir() {
		return filepath.Walk(src, func(path string, fi os.FileInfo, walkErr error) error {
			if walkErr != nil || fi.IsDir() {
				return walkErr
			}
			return addFile(zw, src, path)
		})
	}
	return addFile(zw, filepath.Dir(src), src)
}

func addFile(zw *zip.Writer, base, path string) error {
	f, err := os.Open(path)
	if err != nil {
		return err
	}
	defer f.Close()

	info, err := f.Stat()
	if err != nil {
		return err
	}
	h, err := zip.FileInfoHeader(info)
	if err != nil {
		return err
	}
	rel, _ := filepath.Rel(base, path)
	h.Name = rel
	w, err := zw.CreateHeader(h)
	if err != nil {
		return err
	}
	_, err = io.Copy(w, f)
	return err
}

func backupByCommand(outPath string, commands []config.BackupCommand, name string) error {
	for _, c := range commands {
		if name != "" && c.Name != name {
			continue
		}
		return runCommandToFile(outPath, c.Command)
	}
	if len(commands) == 0 {
		return fmt.Errorf("no command configured")
	}
	return runCommandToFile(outPath, commands[0].Command)
}

func runCommandToFile(outPath, command string) error {
	if command == "" {
		return fmt.Errorf("empty command")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
	defer cancel()

	var cmd *exec.Cmd
	if runtime.GOOS == "windows" {
		cmd = exec.CommandContext(ctx, "powershell", "-Command", command)
	} else {
		cmd = exec.CommandContext(ctx, "sh", "-c", command)
	}
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("%v: %s", err, string(out))
	}

	return os.WriteFile(outPath, out, 0o644)
}

func sanitize(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	s = strings.ReplaceAll(s, " ", "_")
	s = strings.ReplaceAll(s, "/", "_")
	s = strings.ReplaceAll(s, "\\", "_")
	if s == "" {
		return "backup"
	}
	return s
}
