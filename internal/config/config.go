package config

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"

	"gopkg.in/yaml.v3"
)

type Config struct {
	Core         CoreConfig        `yaml:"core" json:"core"`
	Monitor      MonitorConfig     `yaml:"monitor" json:"monitor"`
	Applications []Application     `yaml:"applications" json:"applications"`
	LogAnalysis  LogAnalysisConfig `yaml:"log_analysis" json:"log_analysis"`
	Repair       RepairConfig      `yaml:"repair" json:"repair"`
	Backup       BackupConfig      `yaml:"backup" json:"backup"`
	Databases    []DatabaseTarget  `yaml:"databases" json:"databases"`
	Middleware   MiddlewareConfig  `yaml:"middleware" json:"middleware"`
	Extensions   map[string]any    `yaml:"extensions" json:"extensions"`
}

type CoreConfig struct {
	Web      WebConfig    `yaml:"web" json:"web"`
	SQLite   SQLiteConfig `yaml:"sqlite" json:"sqlite"`
	Auth     AuthConfig   `yaml:"auth" json:"auth"`
	Timezone string       `yaml:"timezone" json:"timezone"`
}

type WebConfig struct {
	Listen string `yaml:"listen" json:"listen"`
}

type SQLiteConfig struct {
	Path     string `yaml:"path" json:"path"`
	Password string `yaml:"password" json:"password"`
}

type AuthConfig struct {
	Username string `yaml:"username" json:"username"`
	Password string `yaml:"password" json:"password"`
}

type MonitorConfig struct {
	RefreshSeconds int        `yaml:"refresh_seconds" json:"refresh_seconds"`
	EnableItems    []string   `yaml:"enable_items" json:"enable_items"`
	DefaultAll     bool       `yaml:"default_all" json:"default_all"`
	SNMP           SNMPConfig `yaml:"snmp" json:"snmp"`
	Nmap           NmapConfig `yaml:"nmap" json:"nmap"`
}

type SNMPConfig struct {
	Enabled        bool         `yaml:"enabled" json:"enabled"`
	TimeoutSeconds int          `yaml:"timeout_seconds" json:"timeout_seconds"`
	Retries        int          `yaml:"retries" json:"retries"`
	Targets        []SNMPTarget `yaml:"targets" json:"targets"`
}

type SNMPTarget struct {
	Name      string    `yaml:"name" json:"name"`
	Host      string    `yaml:"host" json:"host"`
	Port      uint16    `yaml:"port" json:"port"`
	Version   string    `yaml:"version" json:"version"`
	Community string    `yaml:"community" json:"community"`
	OIDs      []SNMPOID `yaml:"oids" json:"oids"`
}

type SNMPOID struct {
	Name string `yaml:"name" json:"name"`
	OID  string `yaml:"oid" json:"oid"`
}

type NmapConfig struct {
	Enabled        bool     `yaml:"enabled" json:"enabled"`
	TimeoutSeconds int      `yaml:"timeout_seconds" json:"timeout_seconds"`
	NmapBinary     string   `yaml:"nmap_binary" json:"nmap_binary"`
	TopPorts       int      `yaml:"top_ports" json:"top_ports"`
	Arguments      []string `yaml:"arguments" json:"arguments"`
	Targets        []string `yaml:"targets" json:"targets"`
}

type Application struct {
	Name         string   `yaml:"name" json:"name"`
	Type         string   `yaml:"type" json:"type"`
	Enabled      bool     `yaml:"enabled" json:"enabled"`
	ProcessNames []string `yaml:"process_names" json:"process_names"`
	Ports        []int    `yaml:"ports" json:"ports"`
	HealthURL    string   `yaml:"health_url" json:"health_url"`
	HealthCmd    string   `yaml:"health_cmd" json:"health_cmd"`
	LogFiles     []string `yaml:"log_files" json:"log_files"`
}

type LogRule struct {
	Name        string `yaml:"name" json:"name"`
	Pattern     string `yaml:"pattern" json:"pattern"`
	Description string `yaml:"description" json:"description"`
}

type LogAnalysisConfig struct {
	EnableRealtime bool        `yaml:"enable_realtime" json:"enable_realtime"`
	MaxLines       int         `yaml:"max_lines" json:"max_lines"`
	Rules          []LogRule   `yaml:"rules" json:"rules"`
	Sources        []LogSource `yaml:"sources" json:"sources"`
}

type LogSource struct {
	Name        string   `yaml:"name" json:"name"`
	Type        string   `yaml:"type" json:"type"`
	Enabled     bool     `yaml:"enabled" json:"enabled"`
	LogFiles    []string `yaml:"log_files" json:"log_files"`
	Description string   `yaml:"description" json:"description"`
}

type RepairScript struct {
	Name        string   `yaml:"name" json:"name"`
	Path        string   `yaml:"path" json:"path"`
	Shell       string   `yaml:"shell" json:"shell"`
	Description string   `yaml:"description" json:"description"`
	Parameters  []string `yaml:"parameters" json:"parameters"`
	Enabled     bool     `yaml:"enabled" json:"enabled"`
}

type RepairConfig struct {
	ScriptRoot string         `yaml:"script_root" json:"script_root"`
	Scripts    []RepairScript `yaml:"scripts" json:"scripts"`
}

type BackupCommand struct {
	Name    string `yaml:"name" json:"name"`
	Command string `yaml:"command" json:"command"`
}

type BackupConfig struct {
	StoragePath string          `yaml:"storage_path" json:"storage_path"`
	Files       []string        `yaml:"files" json:"files"`
	Databases   []BackupCommand `yaml:"databases" json:"databases"`
	ES          []BackupCommand `yaml:"es" json:"es"`
}

type DatabaseTarget struct {
	Name         string   `yaml:"name" json:"name"`
	Host         string   `yaml:"host" json:"host"`
	Port         int      `yaml:"port" json:"port"`
	ProcessNames []string `yaml:"process_names" json:"process_names"`
}

type MiddlewareCheck struct {
	Name         string   `yaml:"name" json:"name"`
	Type         string   `yaml:"type" json:"type"`
	URL          string   `yaml:"url" json:"url"`
	Host         string   `yaml:"host" json:"host"`
	Port         int      `yaml:"port" json:"port"`
	Cmd          string   `yaml:"cmd" json:"cmd"`
	ProcessNames []string `yaml:"process_names" json:"process_names"`
}

type MiddlewareConfig struct {
	Checks []MiddlewareCheck `yaml:"checks" json:"checks"`
}

func LoadOrCreate(path string) (*Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			cfg := DefaultConfig()
			if err := Save(path, cfg); err != nil {
				return nil, err
			}
			return cfg, nil
		}
		return nil, err
	}

	cfg := &Config{}
	if err := yaml.Unmarshal(data, cfg); err != nil {
		return nil, fmt.Errorf("parse yaml failed: %w", err)
	}
	changed := false
	if cfg.Monitor.RefreshSeconds <= 0 {
		cfg.Monitor.RefreshSeconds = 5
		changed = true
	}
	if cfg.Monitor.SNMP.TimeoutSeconds <= 0 {
		cfg.Monitor.SNMP.TimeoutSeconds = 1
		changed = true
	}
	if cfg.Monitor.SNMP.Retries < 0 {
		cfg.Monitor.SNMP.Retries = 0
		changed = true
	}
	if cfg.Monitor.Nmap.TimeoutSeconds <= 0 {
		cfg.Monitor.Nmap.TimeoutSeconds = 6
		changed = true
	}
	if cfg.Monitor.Nmap.NmapBinary == "" {
		cfg.Monitor.Nmap.NmapBinary = "nmap"
		changed = true
	}
	if cfg.Monitor.Nmap.TopPorts <= 0 {
		cfg.Monitor.Nmap.TopPorts = 50
		changed = true
	}
	if cfg.LogAnalysis.MaxLines <= 0 {
		cfg.LogAnalysis.MaxLines = 2000
		changed = true
	}
	if stripLegacyDefaultExampleApp(cfg) {
		changed = true
	}
	if EnsureLogSources(cfg) {
		changed = true
	}
	if cfg.Core.Web.Listen == "" {
		cfg.Core.Web.Listen = "0.0.0.0:18082"
		changed = true
	}
	if strings.TrimSpace(cfg.Core.Auth.Username) == "" {
		cfg.Core.Auth.Username = "admin"
		changed = true
	}
	if strings.TrimSpace(cfg.Core.Auth.Password) == "" {
		cfg.Core.Auth.Password = "123ABCdef"
		changed = true
	}
	if changed {
		if err := Save(path, cfg); err != nil {
			return nil, err
		}
	}
	return cfg, nil
}

func Save(path string, cfg *Config) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	out, err := yaml.Marshal(cfg)
	if err != nil {
		return err
	}
	return os.WriteFile(path, out, 0o644)
}

func DefaultConfig() *Config {
	cfg := &Config{
		Core: CoreConfig{
			Web: WebConfig{
				Listen: "0.0.0.0:18082",
			},
			SQLite: SQLiteConfig{
				Path:     "data/ops-tool.db",
				Password: "ops-fixed-password-2026",
			},
			Auth: AuthConfig{
				Username: "admin",
				Password: "123ABCdef",
			},
			Timezone: "Asia/Shanghai",
		},
		Monitor: MonitorConfig{
			RefreshSeconds: 5,
			DefaultAll:     true,
			EnableItems: []string{
				"cpu", "memory", "disk", "threads", "os", "network", "ports",
				"traffic", "applications", "databases", "es", "nginx", "keepalive", "jvm", "snmp", "nmap",
			},
			SNMP: SNMPConfig{
				Enabled:        true,
				TimeoutSeconds: 1,
				Retries:        0,
				Targets: []SNMPTarget{
					{
						Name:      "local-snmp",
						Host:      "127.0.0.1",
						Port:      161,
						Version:   "v2c",
						Community: "public",
						OIDs: []SNMPOID{
							{Name: "sysName", OID: "1.3.6.1.2.1.1.5.0"},
							{Name: "sysUpTime", OID: "1.3.6.1.2.1.1.3.0"},
							{Name: "sysDescr", OID: "1.3.6.1.2.1.1.1.0"},
						},
					},
				},
			},
			Nmap: NmapConfig{
				Enabled:        true,
				TimeoutSeconds: 6,
				NmapBinary:     "nmap",
				TopPorts:       50,
				Arguments:      []string{"-sT", "--open"},
				Targets:        []string{"127.0.0.1"},
			},
		},
		Applications: []Application{},
		LogAnalysis: LogAnalysisConfig{
			EnableRealtime: true,
			MaxLines:       2000,
			Rules: []LogRule{
				{
					Name:        "timeout",
					Pattern:     "(?i)timeout|deadline exceeded",
					Description: "network or dependency timeout",
				},
				{
					Name:        "db-conn",
					Pattern:     "(?i)too many connections|connection refused|sql",
					Description: "database connection or sql error",
				},
			},
		},
		Repair: RepairConfig{
			ScriptRoot: "scripts",
			Scripts:    []RepairScript{},
		},
		Backup: BackupConfig{
			StoragePath: "backups",
			Files:       []string{"config/config.yaml", "logs"},
			Databases: []BackupCommand{
				{Name: "mysql-default", Command: "echo 'replace with mysqldump command'"},
			},
			ES: []BackupCommand{
				{Name: "es-default", Command: "echo 'replace with elasticsearch snapshot command'"},
			},
		},
		Databases: []DatabaseTarget{
			{Name: "mysql", Host: "127.0.0.1", Port: 3306, ProcessNames: []string{"mysqld", "mysql"}},
		},
		Middleware: MiddlewareConfig{
			Checks: []MiddlewareCheck{
				{Name: "elasticsearch", Type: "http", URL: "http://127.0.0.1:9200", ProcessNames: []string{"elasticsearch", "java"}},
				{Name: "nginx", Type: "http", URL: "http://127.0.0.1/nginx_status", ProcessNames: []string{"nginx"}},
				{Name: "keepalived", Type: "port", Host: "127.0.0.1", Port: 112, ProcessNames: []string{"keepalived"}},
			},
		},
		Extensions: map[string]any{
			"system_monitor": map[string]any{
				"show_top_process_count": 10,
			},
			"log_analysis": map[string]any{
				"default_limit": 300,
			},
			"repair": map[string]any{
				"max_concurrency": 2,
			},
			"backup": map[string]any{
				"keep_latest_count": 30,
			},
		},
	}
	EnsureLogSources(cfg)
	return cfg
}

func EnsureLogSources(cfg *Config) bool {
	if cfg == nil {
		return false
	}
	if len(cfg.LogAnalysis.Sources) > 0 {
		return false
	}
	cfg.LogAnalysis.Sources = buildDefaultLogSources(cfg.Applications)
	return len(cfg.LogAnalysis.Sources) > 0
}

func buildDefaultLogSources(apps []Application) []LogSource {
	sources := make([]LogSource, 0, len(apps)+2)
	sources = append(sources, defaultSystemLogSource())
	for _, app := range apps {
		if !app.Enabled || len(app.LogFiles) == 0 {
			continue
		}
		name := strings.TrimSpace(app.Name)
		if name == "" {
			continue
		}
		sources = append(sources, LogSource{
			Name:        name,
			Type:        "app-log",
			Enabled:     true,
			LogFiles:    append([]string(nil), app.LogFiles...),
			Description: "应用日志",
		})
	}
	return dedupeLogSourcesByName(sources)
}

func defaultSystemLogSource() LogSource {
	switch runtime.GOOS {
	case "windows":
		return LogSource{
			Name:        "系统日志",
			Type:        "windows-eventlog",
			Enabled:     true,
			LogFiles:    []string{"System", "Application", "Security"},
			Description: "Windows 事件日志（System/Application/Security）",
		}
	case "linux":
		return LogSource{
			Name:        "系统日志",
			Type:        "system-log",
			Enabled:     true,
			LogFiles:    []string{"/var/log/syslog", "/var/log/messages", "/var/log/kern.log"},
			Description: "Linux 系统日志",
		}
	case "darwin":
		return LogSource{
			Name:        "系统日志",
			Type:        "system-log",
			Enabled:     true,
			LogFiles:    []string{"/var/log/system.log"},
			Description: "macOS 系统日志",
		}
	default:
		return LogSource{
			Name:        "系统日志",
			Type:        "system-log",
			Enabled:     true,
			LogFiles:    []string{"/var/log/syslog"},
			Description: "系统日志",
		}
	}
}

func dedupeLogSourcesByName(items []LogSource) []LogSource {
	out := make([]LogSource, 0, len(items))
	seen := make(map[string]struct{}, len(items))
	for _, item := range items {
		name := strings.TrimSpace(item.Name)
		if name == "" {
			continue
		}
		if _, ok := seen[name]; ok {
			continue
		}
		seen[name] = struct{}{}
		item.Name = name
		item.Type = strings.TrimSpace(item.Type)
		if item.Type == "" {
			item.Type = "custom-log"
		}
		if len(item.LogFiles) == 0 {
			continue
		}
		item.Enabled = true
		out = append(out, item)
	}
	return out
}

func stripLegacyDefaultExampleApp(cfg *Config) bool {
	if cfg == nil || len(cfg.Applications) != 1 {
		return false
	}
	app := cfg.Applications[0]
	if !isLegacyDefaultExampleApp(app) {
		return false
	}
	cfg.Applications = []Application{}
	if len(cfg.LogAnalysis.Sources) > 0 {
		filtered := make([]LogSource, 0, len(cfg.LogAnalysis.Sources))
		for _, src := range cfg.LogAnalysis.Sources {
			if isLegacyDefaultExampleSource(src) {
				continue
			}
			filtered = append(filtered, src)
		}
		cfg.LogAnalysis.Sources = filtered
	}
	return true
}

func isLegacyDefaultExampleApp(app Application) bool {
	if strings.TrimSpace(app.Name) != "example-api" {
		return false
	}
	if strings.TrimSpace(app.Type) != "go-service" {
		return false
	}
	if !app.Enabled {
		return false
	}
	if len(app.ProcessNames) != 1 || strings.TrimSpace(app.ProcessNames[0]) != "example-api" {
		return false
	}
	if len(app.Ports) != 1 || app.Ports[0] != 8080 {
		return false
	}
	healthURL := strings.TrimSpace(app.HealthURL)
	if healthURL != "" && healthURL != "http://127.0.0.1:8080/health" {
		return false
	}
	if len(app.LogFiles) != 2 {
		return false
	}
	logA := strings.TrimSpace(app.LogFiles[0])
	logB := strings.TrimSpace(app.LogFiles[1])
	return logA == "logs/example-api/info.log" && logB == "logs/example-api/error.log"
}

func isLegacyDefaultExampleSource(src LogSource) bool {
	if strings.TrimSpace(src.Name) != "example-api" {
		return false
	}
	if strings.TrimSpace(src.Type) != "app-log" {
		return false
	}
	if len(src.LogFiles) != 2 {
		return false
	}
	logA := strings.TrimSpace(src.LogFiles[0])
	logB := strings.TrimSpace(src.LogFiles[1])
	return logA == "logs/example-api/info.log" && logB == "logs/example-api/error.log"
}

func (c *Config) FindLogSource(name string) (LogSource, bool) {
	key := strings.TrimSpace(name)
	if key == "" {
		return LogSource{}, false
	}
	for _, src := range c.LogAnalysis.Sources {
		if strings.TrimSpace(src.Name) == key {
			return src, true
		}
	}
	return LogSource{}, false
}

func (c *Config) FindApp(name string) (Application, bool) {
	for _, app := range c.Applications {
		if app.Name == name {
			return app, true
		}
	}
	return Application{}, false
}
