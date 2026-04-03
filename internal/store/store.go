package store

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"ops-tool/internal/config"

	_ "modernc.org/sqlite"
)

type Store struct {
	db *sql.DB

	trendMu          sync.Mutex
	trendLastCleanup time.Time
}

type ScriptRun struct {
	ID         int64     `json:"id"`
	ScriptName string    `json:"script_name"`
	Args       string    `json:"args"`
	Status     string    `json:"status"`
	Output     string    `json:"output"`
	StartedAt  time.Time `json:"started_at"`
	EndedAt    time.Time `json:"ended_at"`
}

type BackupRecord struct {
	ID         int64     `json:"id"`
	Type       string    `json:"type"`
	Name       string    `json:"name"`
	Path       string    `json:"path"`
	Status     string    `json:"status"`
	Message    string    `json:"message"`
	StartedAt  time.Time `json:"started_at"`
	FinishedAt time.Time `json:"finished_at"`
}

type CICDRun struct {
	ID         int64     `json:"id"`
	PipelineID string    `json:"pipeline_id"`
	Name       string    `json:"name"`
	Status     string    `json:"status"`
	Branch     string    `json:"branch"`
	WorkDir    string    `json:"work_dir"`
	Output     string    `json:"output"`
	StartedAt  time.Time `json:"started_at"`
	FinishedAt time.Time `json:"finished_at"`
}

type AppMeta struct {
	AppName          string            `json:"app_name"`
	Description      string            `json:"description"`
	Owner            string            `json:"owner"`
	Notes            string            `json:"notes"`
	Env              map[string]string `json:"env"`
	LastStartAt      time.Time         `json:"last_start_at"`
	LastStartStatus  string            `json:"last_start_status"`
	LastStartMessage string            `json:"last_start_message"`
	UpdatedAt        time.Time         `json:"updated_at"`
}

type MonitorTrendSample struct {
	At           time.Time
	CPUUsage     float64
	MemoryUsage  float64
	ProcessCount float64
	NetInTotal   uint64
	NetOutTotal  uint64
	DiskTotal    uint64
}

type MonitorTrendPoint struct {
	At           time.Time `json:"at"`
	CPUUsage     float64   `json:"cpu_usage"`
	MemoryUsage  float64   `json:"memory_usage"`
	ProcessCount float64   `json:"process_count"`
	NetworkRate  float64   `json:"network_rate"`
	DiskIORate   float64   `json:"diskio_rate"`
}

const (
	trendBucketStep      = 5 * time.Second
	trendRetention       = 24 * time.Hour
	trendCleanupInterval = 5 * time.Minute
)

func Open(path string) (*Store, error) {
	dsn := fmt.Sprintf("file:%s?_pragma=busy_timeout(5000)", path)
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, err
	}
	return &Store{db: db}, nil
}

func (s *Store) Close() error {
	return s.db.Close()
}

func (s *Store) InitSchema() error {
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS settings (
			key TEXT PRIMARY KEY,
			value TEXT NOT NULL,
			updated_at TEXT NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS script_runs (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			script_name TEXT NOT NULL,
			args TEXT NOT NULL,
			status TEXT NOT NULL,
			output TEXT NOT NULL DEFAULT '',
			started_at TEXT NOT NULL,
			ended_at TEXT
		)`,
		`CREATE TABLE IF NOT EXISTS backups (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			type TEXT NOT NULL,
			name TEXT NOT NULL,
			path TEXT NOT NULL,
			status TEXT NOT NULL,
			message TEXT NOT NULL DEFAULT '',
			started_at TEXT NOT NULL,
			finished_at TEXT
		)`,
		`CREATE TABLE IF NOT EXISTS app_meta (
			app_name TEXT PRIMARY KEY,
			description TEXT NOT NULL DEFAULT '',
			owner TEXT NOT NULL DEFAULT '',
			notes TEXT NOT NULL DEFAULT '',
			env_json TEXT NOT NULL DEFAULT '{}',
			last_start_at TEXT NOT NULL DEFAULT '',
			last_start_status TEXT NOT NULL DEFAULT '',
			last_start_message TEXT NOT NULL DEFAULT '',
			updated_at TEXT NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS monitor_trends (
			ts_ms INTEGER PRIMARY KEY,
			cpu_usage REAL NOT NULL,
			memory_usage REAL NOT NULL,
			process_count REAL NOT NULL,
			network_rate REAL NOT NULL,
			diskio_rate REAL NOT NULL,
			net_in_total INTEGER NOT NULL,
			net_out_total INTEGER NOT NULL,
			disk_total INTEGER NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS cicd_runs (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			pipeline_id TEXT NOT NULL,
			name TEXT NOT NULL,
			status TEXT NOT NULL,
			branch TEXT NOT NULL DEFAULT '',
			work_dir TEXT NOT NULL DEFAULT '',
			output TEXT NOT NULL DEFAULT '',
			started_at TEXT NOT NULL,
			finished_at TEXT
		)`,
	}
	for _, stmt := range stmts {
		if _, err := s.db.Exec(stmt); err != nil {
			return err
		}
	}
	return nil
}

func (s *Store) SyncConfig(cfg *config.Config) error {
	payload := map[string]any{
		"core":         cfg.Core,
		"system":       cfg.System,
		"monitor":      cfg.Monitor,
		"applications": cfg.Applications,
		"log_analysis": cfg.LogAnalysis,
		"repair":       cfg.Repair,
		"backup":       cfg.Backup,
		"databases":    cfg.Databases,
		"middleware":   cfg.Middleware,
		"cicd":         cfg.CICD,
		"extensions":   cfg.Extensions,
	}
	for key, value := range payload {
		if err := s.UpsertSetting(key, value); err != nil {
			return err
		}
	}
	return nil
}

func (s *Store) UpsertSetting(key string, value any) error {
	b, err := json.Marshal(value)
	if err != nil {
		return err
	}
	_, err = s.db.Exec(
		`INSERT INTO settings(key, value, updated_at)
		 VALUES(?, ?, ?)
		 ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`,
		key, string(b), time.Now().Format(time.RFC3339),
	)
	return err
}

func (s *Store) CreateScriptRun(scriptName, args string) (int64, error) {
	now := time.Now().Format(time.RFC3339)
	res, err := s.db.Exec(
		`INSERT INTO script_runs(script_name, args, status, output, started_at) VALUES(?, ?, 'running', '', ?)`,
		scriptName, args, now,
	)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

func (s *Store) AppendScriptRunOutput(id int64, chunk string) error {
	_, err := s.db.Exec(`UPDATE script_runs SET output = output || ? WHERE id = ?`, chunk, id)
	return err
}

func (s *Store) FinishScriptRun(id int64, status string) error {
	_, err := s.db.Exec(
		`UPDATE script_runs SET status = ?, ended_at = ? WHERE id = ?`,
		status, time.Now().Format(time.RFC3339), id,
	)
	return err
}

func (s *Store) ListScriptRuns(limit int) ([]ScriptRun, error) {
	if limit <= 0 {
		limit = 50
	}
	rows, err := s.db.Query(
		`SELECT id, script_name, args, status, output, started_at, COALESCE(ended_at, '') 
		 FROM script_runs ORDER BY id DESC LIMIT ?`, limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	res := make([]ScriptRun, 0, limit)
	for rows.Next() {
		var item ScriptRun
		var started, ended string
		if err := rows.Scan(&item.ID, &item.ScriptName, &item.Args, &item.Status, &item.Output, &started, &ended); err != nil {
			return nil, err
		}
		item.StartedAt = parseTime(started)
		item.EndedAt = parseTime(ended)
		res = append(res, item)
	}
	return res, nil
}

func (s *Store) GetScriptRun(id int64) (*ScriptRun, error) {
	var item ScriptRun
	var started, ended string
	err := s.db.QueryRow(
		`SELECT id, script_name, args, status, output, started_at, COALESCE(ended_at, '') FROM script_runs WHERE id = ?`,
		id,
	).Scan(&item.ID, &item.ScriptName, &item.Args, &item.Status, &item.Output, &started, &ended)
	if err != nil {
		return nil, err
	}
	item.StartedAt = parseTime(started)
	item.EndedAt = parseTime(ended)
	return &item, nil
}

func (s *Store) CreateBackupRecord(tp, name, path string) (int64, error) {
	now := time.Now().Format(time.RFC3339)
	res, err := s.db.Exec(
		`INSERT INTO backups(type, name, path, status, message, started_at) VALUES(?, ?, ?, 'running', '', ?)`,
		tp, name, path, now,
	)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

func (s *Store) FinishBackupRecord(id int64, status, message string) error {
	_, err := s.db.Exec(
		`UPDATE backups SET status = ?, message = ?, finished_at = ? WHERE id = ?`,
		status, message, time.Now().Format(time.RFC3339), id,
	)
	return err
}

func (s *Store) ListBackups(limit int) ([]BackupRecord, error) {
	if limit <= 0 {
		limit = 100
	}
	rows, err := s.db.Query(
		`SELECT id, type, name, path, status, message, started_at, COALESCE(finished_at, '') 
		 FROM backups ORDER BY id DESC LIMIT ?`, limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []BackupRecord
	for rows.Next() {
		var item BackupRecord
		var started, finished string
		if err := rows.Scan(&item.ID, &item.Type, &item.Name, &item.Path, &item.Status, &item.Message, &started, &finished); err != nil {
			return nil, err
		}
		item.StartedAt = parseTime(started)
		item.FinishedAt = parseTime(finished)
		items = append(items, item)
	}
	return items, nil
}

func (s *Store) CreateCICDRun(pipelineID, name, branch, workDir string) (int64, error) {
	now := time.Now().Format(time.RFC3339)
	res, err := s.db.Exec(
		`INSERT INTO cicd_runs(pipeline_id, name, status, branch, work_dir, output, started_at)
		 VALUES(?, ?, 'running', ?, ?, '', ?)`,
		pipelineID, name, branch, workDir, now,
	)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

func (s *Store) AppendCICDRunOutput(id int64, chunk string) error {
	_, err := s.db.Exec(`UPDATE cicd_runs SET output = output || ? WHERE id = ?`, chunk, id)
	return err
}

func (s *Store) FinishCICDRun(id int64, status string) error {
	_, err := s.db.Exec(
		`UPDATE cicd_runs SET status = ?, finished_at = ? WHERE id = ?`,
		status, time.Now().Format(time.RFC3339), id,
	)
	return err
}

func (s *Store) ListCICDRuns(limit int) ([]CICDRun, error) {
	if limit <= 0 {
		limit = 100
	}
	rows, err := s.db.Query(
		`SELECT id, pipeline_id, name, status, branch, work_dir, output, started_at, COALESCE(finished_at, '')
		 FROM cicd_runs ORDER BY id DESC LIMIT ?`,
		limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]CICDRun, 0, limit)
	for rows.Next() {
		var item CICDRun
		var started, finished string
		if err := rows.Scan(&item.ID, &item.PipelineID, &item.Name, &item.Status, &item.Branch, &item.WorkDir, &item.Output, &started, &finished); err != nil {
			return nil, err
		}
		item.StartedAt = parseTime(started)
		item.FinishedAt = parseTime(finished)
		items = append(items, item)
	}
	return items, nil
}

func (s *Store) GetCICDRun(id int64) (*CICDRun, error) {
	var item CICDRun
	var started, finished string
	err := s.db.QueryRow(
		`SELECT id, pipeline_id, name, status, branch, work_dir, output, started_at, COALESCE(finished_at, '')
		 FROM cicd_runs WHERE id = ?`,
		id,
	).Scan(&item.ID, &item.PipelineID, &item.Name, &item.Status, &item.Branch, &item.WorkDir, &item.Output, &started, &finished)
	if err != nil {
		return nil, err
	}
	item.StartedAt = parseTime(started)
	item.FinishedAt = parseTime(finished)
	return &item, nil
}

func parseTime(raw string) time.Time {
	if raw == "" {
		return time.Time{}
	}
	t, err := time.Parse(time.RFC3339, raw)
	if err != nil {
		return time.Time{}
	}
	return t
}

func (s *Store) ListAppMeta() ([]AppMeta, error) {
	rows, err := s.db.Query(
		`SELECT app_name, description, owner, notes, env_json, last_start_at, last_start_status, last_start_message, updated_at
		 FROM app_meta
		 ORDER BY app_name ASC`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]AppMeta, 0, 64)
	for rows.Next() {
		var item AppMeta
		var envJSON, lastStartAt, updatedAt string
		if err := rows.Scan(
			&item.AppName,
			&item.Description,
			&item.Owner,
			&item.Notes,
			&envJSON,
			&lastStartAt,
			&item.LastStartStatus,
			&item.LastStartMessage,
			&updatedAt,
		); err != nil {
			return nil, err
		}
		item.Env = decodeAppMetaEnv(envJSON)
		item.LastStartAt = parseTime(lastStartAt)
		item.UpdatedAt = parseTime(updatedAt)
		items = append(items, item)
	}
	return items, nil
}

func (s *Store) GetAppMeta(name string) (*AppMeta, error) {
	var item AppMeta
	var envJSON, lastStartAt, updatedAt string
	err := s.db.QueryRow(
		`SELECT app_name, description, owner, notes, env_json, last_start_at, last_start_status, last_start_message, updated_at
		 FROM app_meta
		 WHERE app_name = ?`,
		name,
	).Scan(
		&item.AppName,
		&item.Description,
		&item.Owner,
		&item.Notes,
		&envJSON,
		&lastStartAt,
		&item.LastStartStatus,
		&item.LastStartMessage,
		&updatedAt,
	)
	if err != nil {
		return nil, err
	}
	item.Env = decodeAppMetaEnv(envJSON)
	item.LastStartAt = parseTime(lastStartAt)
	item.UpdatedAt = parseTime(updatedAt)
	return &item, nil
}

func (s *Store) UpsertAppMeta(meta AppMeta) error {
	envJSON, err := encodeAppMetaEnv(meta.Env)
	if err != nil {
		return err
	}
	lastStartAt := ""
	if !meta.LastStartAt.IsZero() {
		lastStartAt = meta.LastStartAt.Format(time.RFC3339)
	}
	updatedAt := meta.UpdatedAt
	if updatedAt.IsZero() {
		updatedAt = time.Now()
	}

	_, err = s.db.Exec(
		`INSERT INTO app_meta(
			app_name, description, owner, notes, env_json, last_start_at, last_start_status, last_start_message, updated_at
		) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(app_name) DO UPDATE SET
			description=excluded.description,
			owner=excluded.owner,
			notes=excluded.notes,
			env_json=excluded.env_json,
			last_start_at=excluded.last_start_at,
			last_start_status=excluded.last_start_status,
			last_start_message=excluded.last_start_message,
			updated_at=excluded.updated_at`,
		meta.AppName,
		meta.Description,
		meta.Owner,
		meta.Notes,
		envJSON,
		lastStartAt,
		meta.LastStartStatus,
		meta.LastStartMessage,
		updatedAt.Format(time.RFC3339),
	)
	return err
}

func (s *Store) UpdateAppStartResult(appName, status, message string, startedAt time.Time) error {
	if startedAt.IsZero() {
		startedAt = time.Now()
	}
	_, err := s.db.Exec(
		`INSERT INTO app_meta(
			app_name, description, owner, notes, env_json, last_start_at, last_start_status, last_start_message, updated_at
		) VALUES(?, '', '', '', '{}', ?, ?, ?, ?)
		ON CONFLICT(app_name) DO UPDATE SET
			last_start_at=excluded.last_start_at,
			last_start_status=excluded.last_start_status,
			last_start_message=excluded.last_start_message,
			updated_at=excluded.updated_at`,
		appName,
		startedAt.Format(time.RFC3339),
		status,
		message,
		time.Now().Format(time.RFC3339),
	)
	return err
}

func (s *Store) DeleteAppMeta(name string) error {
	_, err := s.db.Exec(`DELETE FROM app_meta WHERE app_name = ?`, name)
	return err
}

func encodeAppMetaEnv(env map[string]string) (string, error) {
	if env == nil {
		env = map[string]string{}
	}
	b, err := json.Marshal(env)
	if err != nil {
		return "", err
	}
	return string(b), nil
}

func decodeAppMetaEnv(raw string) map[string]string {
	trimmed := raw
	if trimmed == "" {
		return map[string]string{}
	}
	var out map[string]string
	if err := json.Unmarshal([]byte(trimmed), &out); err != nil || out == nil {
		return map[string]string{}
	}
	return out
}

func (s *Store) UpsertMonitorTrend(sample MonitorTrendSample) error {
	if sample.At.IsZero() {
		sample.At = time.Now()
	}
	ts := bucketMillis(sample.At, trendBucketStep)
	cutoff := ts - int64(trendRetention/time.Millisecond)

	netIn := uint64ToInt64(sample.NetInTotal)
	netOut := uint64ToInt64(sample.NetOutTotal)
	disk := uint64ToInt64(sample.DiskTotal)

	if _, err := s.db.Exec(
		`INSERT INTO monitor_trends(
			ts_ms, cpu_usage, memory_usage, process_count, network_rate, diskio_rate, net_in_total, net_out_total, disk_total
		) VALUES(?, ?, ?, ?, 0, 0, ?, ?, ?)
		ON CONFLICT(ts_ms) DO NOTHING`,
		ts,
		sample.CPUUsage,
		sample.MemoryUsage,
		sample.ProcessCount,
		netIn,
		netOut,
		disk,
	); err != nil {
		return err
	}

	s.cleanupMonitorTrends(cutoff)
	return nil
}

func (s *Store) ListMonitorTrends(since time.Time) ([]MonitorTrendPoint, error) {
	sinceMS := since.UnixMilli()
	rows, err := s.db.Query(
		`SELECT ts_ms, cpu_usage, memory_usage, process_count, net_in_total, net_out_total, disk_total
		 FROM monitor_trends
		 WHERE ts_ms >= ?
		 ORDER BY ts_ms ASC`,
		sinceMS,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]MonitorTrendPoint, 0, 2048)
	var prevTS int64
	var prevIn, prevOut, prevDisk int64
	for rows.Next() {
		var ts int64
		var item MonitorTrendPoint
		var netIn, netOut, diskTotal int64
		if err := rows.Scan(&ts, &item.CPUUsage, &item.MemoryUsage, &item.ProcessCount, &netIn, &netOut, &diskTotal); err != nil {
			return nil, err
		}
		item.NetworkRate = 0
		item.DiskIORate = 0
		if prevTS > 0 {
			dt := float64(ts-prevTS) / 1000.0
			if dt > 0 {
				inRate := float64(netIn-prevIn) / dt
				outRate := float64(netOut-prevOut) / dt
				if inRate < 0 {
					inRate = 0
				}
				if outRate < 0 {
					outRate = 0
				}
				item.NetworkRate = inRate + outRate

				d := float64(diskTotal-prevDisk) / dt
				if d < 0 {
					d = 0
				}
				item.DiskIORate = d
			}
		}
		item.At = time.UnixMilli(ts)
		items = append(items, item)
		prevTS = ts
		prevIn = netIn
		prevOut = netOut
		prevDisk = diskTotal
	}
	return items, nil
}

func bucketMillis(t time.Time, step time.Duration) int64 {
	if step <= 0 {
		return t.UnixMilli()
	}
	stepMS := int64(step / time.Millisecond)
	if stepMS <= 1 {
		return t.UnixMilli()
	}
	ms := t.UnixMilli()
	return (ms / stepMS) * stepMS
}

func uint64ToInt64(v uint64) int64 {
	const maxInt64 = uint64(1<<63 - 1)
	if v > maxInt64 {
		return int64(maxInt64)
	}
	return int64(v)
}

func (s *Store) cleanupMonitorTrends(cutoff int64) {
	now := time.Now()
	shouldRun := false

	s.trendMu.Lock()
	if s.trendLastCleanup.IsZero() || now.Sub(s.trendLastCleanup) >= trendCleanupInterval {
		s.trendLastCleanup = now
		shouldRun = true
	}
	s.trendMu.Unlock()

	if !shouldRun {
		return
	}
	_, _ = s.db.Exec(`DELETE FROM monitor_trends WHERE ts_ms < ?`, cutoff)
}
