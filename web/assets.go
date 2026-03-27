package webassets

import (
	"embed"
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
)

// FS contains frontend templates/static assets bundled in binaries.
//
//go:embed templates static
var FS embed.FS

// EnsureOnDisk materializes embedded frontend assets under <baseDir>/web.
// Existing files are preserved and will not be overwritten.
func EnsureOnDisk(baseDir string) error {
	baseDir = strings.TrimSpace(baseDir)
	if baseDir == "" {
		return errors.New("base dir is empty")
	}

	targetRoot := filepath.Join(baseDir, "web")
	if err := os.MkdirAll(targetRoot, 0o755); err != nil {
		return err
	}

	return fs.WalkDir(FS, ".", func(path string, d fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if path == "." {
			return nil
		}

		dst := filepath.Join(targetRoot, filepath.FromSlash(path))
		if d.IsDir() {
			return os.MkdirAll(dst, 0o755)
		}

		if _, err := os.Stat(dst); err == nil {
			return nil
		} else if !errors.Is(err, os.ErrNotExist) {
			return err
		}

		content, err := FS.ReadFile(path)
		if err != nil {
			return err
		}
		if err := os.MkdirAll(filepath.Dir(dst), 0o755); err != nil {
			return err
		}
		return os.WriteFile(dst, content, 0o644)
	})
}
