package docker

import (
	"context"
	"encoding/json"
	"fmt"
	"os/exec"
	"strconv"
	"strings"
	"time"
)

type Client struct {
	timeout time.Duration
}

type Status struct {
	Available     bool   `json:"available"`
	Installed     bool   `json:"installed"`
	DaemonRunning bool   `json:"daemon_running"`
	Version       string `json:"version"`
	ServerVersion string `json:"server_version"`
	Context       string `json:"context"`
	Platform      string `json:"platform"`
	Error         string `json:"error,omitempty"`
}

type Container struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	Image      string `json:"image"`
	Command    string `json:"command"`
	CreatedAt  string `json:"created_at"`
	RunningFor string `json:"running_for"`
	Ports      string `json:"ports"`
	Status     string `json:"status"`
	State      string `json:"state"`
}

type ContainerActionOptions struct {
	RemoveVolumes bool
}

func NewClient(timeout time.Duration) *Client {
	if timeout <= 0 {
		timeout = 15 * time.Second
	}
	return &Client{timeout: timeout}
}

func (c *Client) Status(ctx context.Context) Status {
	st := Status{}
	if c.commandExists() == false {
		return st
	}
	st.Available = true
	st.Installed = true

	if out, _ := c.runRaw(ctx, "version", "--format", "{{json .Client}}"); out != "" {
		if line := firstJSONLine(out); line != "" {
			var clientMap map[string]any
			if err := json.Unmarshal([]byte(line), &clientMap); err == nil {
				st.Version = stringify(clientMap["Version"])
				st.Context = stringify(clientMap["Context"])
				if platformMap, ok := clientMap["Platform"].(map[string]any); ok {
					st.Platform = stringify(platformMap["Name"])
				}
				if st.Platform == "" {
					st.Platform = stringify(clientMap["Os"]) + "/" + stringify(clientMap["Arch"])
					st.Platform = strings.Trim(st.Platform, "/")
				}
			}
		}
	}

	serverVersion, err := c.runRaw(ctx, "info", "--format", "{{.ServerVersion}}")
	if err == nil {
		serverVersion = strings.TrimSpace(serverVersion)
		if serverVersion != "" && !strings.EqualFold(serverVersion, "<no value>") {
			st.DaemonRunning = true
			st.ServerVersion = serverVersion
		}
	}
	if !st.DaemonRunning {
		st.Error = "daemon_unavailable"
	}
	return st
}

func (c *Client) ListContainers(ctx context.Context, all bool) ([]Container, error) {
	args := []string{"ps", "--no-trunc", "--format", "{{json .}}"}
	if all {
		args = append(args, "-a")
	}
	out, err := c.run(ctx, args...)
	if err != nil {
		return nil, err
	}
	lines := strings.Split(strings.ReplaceAll(out, "\r\n", "\n"), "\n")
	items := make([]Container, 0, len(lines))
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		var row map[string]any
		if err := json.Unmarshal([]byte(line), &row); err != nil {
			continue
		}
		items = append(items, Container{
			ID:         stringify(row["ID"]),
			Name:       stringify(row["Names"]),
			Image:      stringify(row["Image"]),
			Command:    stringify(row["Command"]),
			CreatedAt:  stringify(row["CreatedAt"]),
			RunningFor: stringify(row["RunningFor"]),
			Ports:      stringify(row["Ports"]),
			Status:     stringify(row["Status"]),
			State:      strings.ToLower(strings.TrimSpace(stringify(row["State"]))),
		})
	}
	return items, nil
}

func (c *Client) ContainerAction(ctx context.Context, id, action string, opts ContainerActionOptions) (string, error) {
	id = strings.TrimSpace(id)
	action = strings.ToLower(strings.TrimSpace(action))
	if id == "" {
		return "", fmt.Errorf("container id is required")
	}

	var args []string
	switch action {
	case "start", "stop", "restart":
		args = []string{action, id}
	case "remove":
		args = []string{"rm", "-f"}
		if opts.RemoveVolumes {
			args = append(args, "-v")
		}
		args = append(args, id)
	default:
		return "", fmt.Errorf("unsupported action: %s", action)
	}
	return c.run(ctx, args...)
}

func (c *Client) ContainerLogs(ctx context.Context, id string, tail int) (string, error) {
	id = strings.TrimSpace(id)
	if id == "" {
		return "", fmt.Errorf("container id is required")
	}
	if tail <= 0 {
		tail = 200
	}
	if tail > 4000 {
		tail = 4000
	}
	return c.run(ctx, "logs", "--tail", strconv.Itoa(tail), id)
}

func (c *Client) ContainerInspect(ctx context.Context, id string) (string, error) {
	id = strings.TrimSpace(id)
	if id == "" {
		return "", fmt.Errorf("container id is required")
	}
	return c.run(ctx, "inspect", id)
}

func (c *Client) commandExists() bool {
	looked, lookErr := exec.LookPath("docker")
	if lookErr != nil || strings.TrimSpace(looked) == "" {
		return false
	}
	return true
}

func (c *Client) run(ctx context.Context, args ...string) (string, error) {
	text, err := c.runRaw(ctx, args...)
	if err != nil {
		if strings.TrimSpace(text) == "" {
			return "", err
		}
		return "", fmt.Errorf("%s", text)
	}
	return strings.TrimSpace(text), nil
}

func (c *Client) runRaw(ctx context.Context, args ...string) (string, error) {
	if len(args) == 0 {
		return "", fmt.Errorf("docker args required")
	}

	timeout := c.timeout
	if timeout <= 0 {
		timeout = 15 * time.Second
	}
	runCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	cmd := exec.CommandContext(runCtx, "docker", args...)
	out, err := cmd.CombinedOutput()
	text := strings.TrimSpace(string(out))
	return text, err
}

func firstJSONLine(raw string) string {
	if strings.TrimSpace(raw) == "" {
		return ""
	}
	lines := strings.Split(strings.ReplaceAll(raw, "\r\n", "\n"), "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "{") && strings.HasSuffix(line, "}") {
			return line
		}
	}
	return ""
}

func stringify(v any) string {
	switch x := v.(type) {
	case nil:
		return ""
	case string:
		return strings.TrimSpace(x)
	case fmt.Stringer:
		return strings.TrimSpace(x.String())
	case float64:
		if x == float64(int64(x)) {
			return strconv.FormatInt(int64(x), 10)
		}
		return strconv.FormatFloat(x, 'f', -1, 64)
	case int, int64, int32, uint, uint64, uint32:
		return fmt.Sprintf("%v", x)
	case bool:
		if x {
			return "true"
		}
		return "false"
	default:
		return strings.TrimSpace(fmt.Sprintf("%v", x))
	}
}
