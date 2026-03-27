package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"ops-tool/internal/config"
	"ops-tool/internal/store"
	"ops-tool/internal/web"
	webassets "ops-tool/web"
)

var version = "dev"

func main() {
	baseDir, err := resolveBaseDir()
	if err != nil {
		log.Fatalf("resolve base dir failed: %v", err)
	}
	if err := webassets.EnsureOnDisk(baseDir); err != nil {
		log.Fatalf("prepare frontend assets failed: %v", err)
	}

	configPath := filepath.Join(baseDir, "config", "config.yaml")
	cfg, err := config.LoadOrCreate(configPath)
	if err != nil {
		log.Fatalf("load config failed: %v", err)
	}

	sqlitePath := cfg.Core.SQLite.Path
	if !filepath.IsAbs(sqlitePath) {
		sqlitePath = filepath.Join(baseDir, sqlitePath)
	}

	if err := os.MkdirAll(filepath.Dir(sqlitePath), 0o755); err != nil {
		log.Fatalf("mkdir sqlite dir failed: %v", err)
	}

	st, err := store.Open(sqlitePath)
	if err != nil {
		log.Fatalf("open sqlite failed: %v", err)
	}
	defer st.Close()

	if err := st.InitSchema(); err != nil {
		log.Fatalf("init schema failed: %v", err)
	}

	if err := st.SyncConfig(cfg); err != nil {
		log.Fatalf("sync config failed: %v", err)
	}

	srv, err := web.NewServer(baseDir, configPath, cfg, st)
	if err != nil {
		log.Fatalf("init server failed: %v", err)
	}

	addr := cfg.Core.Web.Listen
	log.Printf("ops-tool %s started at http://%s", version, addr)
	serverErrCh := make(chan error, 1)
	go func() {
		serverErrCh <- srv.Start(addr)
	}()
	go tryAutoOpenDashboard(addr)

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, os.Interrupt, syscall.SIGTERM)
	defer signal.Stop(sigCh)

	select {
	case err := <-serverErrCh:
		if err != nil {
			log.Fatalf("server stopped: %v", err)
		}
	case sig := <-sigCh:
		log.Printf("received signal %s, shutting down...", sig.String())
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		if err := srv.Shutdown(ctx); err != nil {
			log.Printf("graceful shutdown error: %v", err)
		}
		if err := <-serverErrCh; err != nil {
			log.Printf("server exit error: %v", err)
		}
		log.Printf("server stopped")
	}
}

func resolveBaseDir() (string, error) {
	cwd, _ := os.Getwd()
	exePath, _ := os.Executable()
	exeDir := filepath.Dir(exePath)

	candidates := dedupeNonEmpty(
		cwd,
		exeDir,
	)
	for _, c := range candidates {
		if hasWebTemplate(c) {
			return c, nil
		}
	}

	if cwd != "" {
		return cwd, nil
	}
	if exeDir != "" {
		return exeDir, nil
	}
	return "", fmt.Errorf("cannot determine runtime base directory")
}

func hasWebTemplate(base string) bool {
	if strings.TrimSpace(base) == "" {
		return false
	}
	target := filepath.Join(base, "web", "templates", "index.html")
	_, err := os.Stat(target)
	return err == nil
}

func dedupeNonEmpty(items ...string) []string {
	out := make([]string, 0, len(items))
	seen := make(map[string]struct{}, len(items))
	for _, item := range items {
		item = strings.TrimSpace(item)
		if item == "" {
			continue
		}
		abs, err := filepath.Abs(item)
		if err == nil {
			item = abs
		}
		if _, ok := seen[item]; ok {
			continue
		}
		seen[item] = struct{}{}
		out = append(out, item)
	}
	return out
}
