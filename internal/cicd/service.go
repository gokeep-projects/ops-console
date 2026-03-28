package cicd

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"

	"ops-tool/internal/config"
	"ops-tool/internal/store"
	"ops-tool/internal/systemlog"
)

type Manager struct {
	store *store.Store

	mu      sync.Mutex
	running map[int64]context.CancelFunc
}

func NewManager(st *store.Store) *Manager {
	return &Manager{
		store:   st,
		running: make(map[int64]context.CancelFunc),
	}
}

func (m *Manager) Start(baseDir string, systemCfg config.SystemConfig, pipeline config.PipelineConfig) (int64, error) {
	workDir := resolvePath(baseDir, fallback(pipeline.WorkDir, systemCfg.DefaultWorkDir, "."))
	runID, err := m.store.CreateCICDRun(pipeline.ID, pipeline.Name, pipeline.Branch, workDir)
	if err != nil {
		return 0, err
	}

	timeout := time.Duration(max(pipeline.TimeoutMinutes, 1)) * time.Minute
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	m.mu.Lock()
	m.running[runID] = cancel
	m.mu.Unlock()

	go m.run(ctx, runID, baseDir, systemCfg, pipeline, workDir)
	return runID, nil
}

func (m *Manager) Stop(runID int64) bool {
	m.mu.Lock()
	cancel, ok := m.running[runID]
	m.mu.Unlock()
	if !ok {
		return false
	}
	cancel()
	return true
}

func (m *Manager) run(ctx context.Context, runID int64, baseDir string, systemCfg config.SystemConfig, pipeline config.PipelineConfig, workDir string) {
	defer func() {
		m.mu.Lock()
		delete(m.running, runID)
		m.mu.Unlock()
	}()

	appendLine := func(format string, args ...any) {
		line := fmt.Sprintf(format, args...)
		if !strings.HasSuffix(line, "\n") {
			line += "\n"
		}
		_ = m.store.AppendCICDRunOutput(runID, line)
		systemlog.Add("info", "cicd", fmt.Sprintf("pipeline=%s run=%d %s", pipeline.ID, runID, strings.TrimSpace(line)))
	}

	appendLine("流水线启动: %s (%s)", pipeline.Name, pipeline.ID)
	appendLine("工作目录: %s", workDir)
	if pipeline.Branch != "" {
		appendLine("目标分支: %s", pipeline.Branch)
	}

	status := "success"
	for idx, stage := range pipeline.Stages {
		select {
		case <-ctx.Done():
			status = "cancelled"
			appendLine("流水线已停止: %v", ctx.Err())
			_ = m.store.FinishCICDRun(runID, status)
			return
		default:
		}

		stageName := fallback(stage.Name, fmt.Sprintf("阶段-%d", idx+1))
		appendLine(">>> 开始阶段: %s", stageName)
		if err := m.runStage(ctx, runID, baseDir, systemCfg, pipeline, workDir, stage); err != nil {
			appendLine("阶段失败: %s | %v", stageName, err)
			if stage.ContinueOnError {
				appendLine("阶段配置为失败继续，进入下一阶段")
				continue
			}
			if ctx.Err() != nil {
				status = "cancelled"
			} else {
				status = "failed"
			}
			_ = m.store.FinishCICDRun(runID, status)
			return
		}
		appendLine("<<< 阶段完成: %s", stageName)
	}
	appendLine("流水线执行完成")
	_ = m.store.FinishCICDRun(runID, status)
}

func (m *Manager) runStage(ctx context.Context, runID int64, baseDir string, systemCfg config.SystemConfig, pipeline config.PipelineConfig, workDir string, stage config.PipelineStage) error {
	command := strings.TrimSpace(stage.Command)
	if command == "" {
		return fmt.Errorf("empty stage command")
	}
	cmd := commandForShell(ctx, fallback(pipeline.Shell, systemCfg.DefaultShell), command)
	cmd.Dir = workDir
	cmd.Env = buildStageEnv(baseDir, pipeline, workDir)

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return err
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		return err
	}
	if err := cmd.Start(); err != nil {
		return err
	}

	var wg sync.WaitGroup
	wg.Add(2)
	go m.capturePipe(&wg, runID, stdout)
	go m.capturePipe(&wg, runID, stderr)
	waitErr := cmd.Wait()
	wg.Wait()
	return waitErr
}

func (m *Manager) capturePipe(wg *sync.WaitGroup, runID int64, reader io.Reader) {
	defer wg.Done()
	scanner := bufio.NewScanner(reader)
	scanner.Buffer(make([]byte, 0, 64*1024), 2*1024*1024)
	for scanner.Scan() {
		line := scanner.Text()
		if strings.TrimSpace(line) == "" {
			continue
		}
		_ = m.store.AppendCICDRunOutput(runID, line+"\n")
	}
}

func buildStageEnv(baseDir string, pipeline config.PipelineConfig, workDir string) []string {
	env := append([]string(nil), os.Environ()...)
	env = append(env,
		"OPS_PIPELINE_ID="+pipeline.ID,
		"OPS_PIPELINE_NAME="+pipeline.Name,
		"OPS_PIPELINE_BRANCH="+pipeline.Branch,
		"OPS_PIPELINE_WORKDIR="+workDir,
		"OPS_BASE_DIR="+baseDir,
	)
	for key, value := range pipeline.Env {
		k := strings.TrimSpace(key)
		if k == "" {
			continue
		}
		env = append(env, k+"="+value)
	}
	return env
}

func commandForShell(ctx context.Context, shell, command string) *exec.Cmd {
	shell = strings.ToLower(strings.TrimSpace(shell))
	switch shell {
	case "powershell", "pwsh":
		bin := "powershell"
		if shell == "pwsh" {
			bin = "pwsh"
		}
		return exec.CommandContext(ctx, bin, "-NoProfile", "-Command", command)
	case "cmd":
		return exec.CommandContext(ctx, "cmd", "/C", command)
	case "bash":
		return exec.CommandContext(ctx, "bash", "-lc", command)
	default:
		if runtime.GOOS == "windows" {
			return exec.CommandContext(ctx, "powershell", "-NoProfile", "-Command", command)
		}
		return exec.CommandContext(ctx, "sh", "-lc", command)
	}
}

func resolvePath(baseDir, p string) string {
	if filepath.IsAbs(p) {
		return filepath.Clean(p)
	}
	return filepath.Clean(filepath.Join(baseDir, p))
}

func fallback(values ...string) string {
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value != "" {
			return value
		}
	}
	return ""
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}
