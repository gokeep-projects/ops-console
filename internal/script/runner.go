package script

import (
	"bufio"
	"context"
	"errors"
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

type Runner struct {
	store *store.Store
}

func NewRunner(st *store.Store) *Runner {
	return &Runner{store: st}
}

func (r *Runner) Run(script config.RepairScript, args []string) (int64, error) {
	if !script.Enabled {
		return 0, errors.New("script is disabled")
	}
	if script.Path == "" {
		return 0, errors.New("script path empty")
	}
	if _, err := os.Stat(script.Path); err != nil {
		return 0, err
	}

	runID, err := r.store.CreateScriptRun(script.Name, strings.Join(args, " "))
	if err != nil {
		return 0, err
	}

	go r.runAsync(runID, script, args)
	return runID, nil
}

func (r *Runner) runAsync(runID int64, script config.RepairScript, args []string) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
	defer cancel()

	cmd, err := buildCommand(ctx, script, args)
	if err != nil {
		_ = r.store.AppendScriptRunOutput(runID, fmt.Sprintf("build command failed: %v\n", err))
		_ = r.store.FinishScriptRun(runID, "failed")
		return
	}

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		_ = r.store.AppendScriptRunOutput(runID, fmt.Sprintf("stdout pipe failed: %v\n", err))
		_ = r.store.FinishScriptRun(runID, "failed")
		return
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		_ = r.store.AppendScriptRunOutput(runID, fmt.Sprintf("stderr pipe failed: %v\n", err))
		_ = r.store.FinishScriptRun(runID, "failed")
		return
	}

	if err := cmd.Start(); err != nil {
		_ = r.store.AppendScriptRunOutput(runID, fmt.Sprintf("start failed: %v\n", err))
		_ = r.store.FinishScriptRun(runID, "failed")
		return
	}

	done := make(chan struct{}, 2)
	go scanPipe(runID, stdout, r.store, done)
	go scanPipe(runID, stderr, r.store, done)

	err = cmd.Wait()
	<-done
	<-done

	if err != nil {
		_ = r.store.AppendScriptRunOutput(runID, fmt.Sprintf("exit with error: %v\n", err))
		_ = r.store.FinishScriptRun(runID, "failed")
		return
	}
	_ = r.store.FinishScriptRun(runID, "success")
}

func scanPipe(runID int64, pipe io.ReadCloser, st *store.Store, done chan<- struct{}) {
	defer func() {
		_ = pipe.Close()
		done <- struct{}{}
	}()
	scanner := bufio.NewScanner(pipe)
	scanner.Buffer(make([]byte, 1024), 1024*1024)
	for scanner.Scan() {
		line := scanner.Text()
		_ = st.AppendScriptRunOutput(runID, line+"\n")
	}
}

func buildCommand(ctx context.Context, script config.RepairScript, args []string) (*exec.Cmd, error) {
	ext := strings.ToLower(filepath.Ext(script.Path))
	shell := strings.ToLower(strings.TrimSpace(script.Shell))

	if shell == "" {
		switch ext {
		case ".ps1":
			shell = "powershell"
		case ".bat", ".cmd":
			shell = "cmd"
		case ".sh":
			shell = "sh"
		default:
			shell = "exec"
		}
	}

	switch shell {
	case "powershell":
		c := []string{"-ExecutionPolicy", "Bypass", "-File", script.Path}
		c = append(c, args...)
		return exec.CommandContext(ctx, "powershell", c...), nil
	case "cmd":
		c := []string{"/C", script.Path}
		c = append(c, args...)
		return exec.CommandContext(ctx, "cmd", c...), nil
	case "sh", "bash":
		if runtime.GOOS == "windows" {
			if _, err := exec.LookPath("bash"); err != nil {
				return nil, errors.New("bash not found on windows")
			}
			c := append([]string{script.Path}, args...)
			return exec.CommandContext(ctx, "bash", c...), nil
		}
		c := append([]string{script.Path}, args...)
		return exec.CommandContext(ctx, "sh", c...), nil
	case "exec":
		return exec.CommandContext(ctx, script.Path, args...), nil
	default:
		return nil, fmt.Errorf("unsupported shell: %s", shell)
	}
}
