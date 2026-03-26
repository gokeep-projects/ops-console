# Ops Tool (Go monolith)

## Run

```powershell
go mod tidy
go run ./cmd/ops
```

Default URL: `http://127.0.0.1:18081`

## Features

- System monitor: CPU, memory, disk, threads, OS, network, ports, top processes, JVM, app/db/middleware status
- Log analysis: app cards, full-text search, `info/error` filter, rule-based query, ZIP export
- Repair tools: script upload, parameterized execution, execution output tracking, run history
- Data backup: files / database / ES backup trigger, record list, downloadable backup files
- Config model: `config/config.yaml` is the source of truth, non-application config syncs to SQLite

## Config and persistence constraints

- Config file: `config/config.yaml`
- SQLite path and password are fixed fields in config: `core.sqlite.path` and `core.sqlite.password`
- Application definitions (`applications`) stay in config file only, not stored in SQLite
- Other config sections are synced to SQLite `settings` table

## Multi-platform build

```powershell
./scripts/build.ps1 -Version 0.1.0
```

Output binaries:

- `dist/ops-tool-windows-amd64.exe`
- `dist/ops-tool-windows-arm64.exe`
- `dist/ops-tool-linux-amd64`
- `dist/ops-tool-linux-arm64`
