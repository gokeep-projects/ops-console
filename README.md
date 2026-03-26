# Ops Console / ops-tool

一个基于 Go 的运维控制台单体应用。服务端负责系统监控、日志检索、修复脚本执行、备份任务管理和配置持久化，前端直接由内置 HTTP 服务提供静态页面，不依赖 Node.js 构建链。

## 项目定位

这个项目适合部署在单机或运维跳板机上，统一查看和处理以下工作：

- 系统资源与运行态监控
- 业务应用、数据库、中间件存活检查
- 本地日志检索与导出
- 运维修复脚本上传、执行、留痕
- 文件 / 数据库 / ES 备份触发与下载

## 功能概览

### 1. 系统监控

- CPU、内存、磁盘、磁盘 IO、网络流量、进程数、线程数
- 监听端口和端口所属进程
- Top 进程排行与 JVM 进程识别
- 应用、数据库、中间件健康状态聚合
- SNMP 采集
- Nmap 端口扫描
- 24 小时趋势数据落 SQLite，前端可查看放大趋势图

### 2. 日志分析

- 基于应用卡片管理日志源
- 关键字全文检索
- `info` / `error` 快速过滤
- 预置规则匹配，例如超时、数据库连接异常
- 结果导出

### 3. 修复工具

- 上传 `ps1` / `sh` / `bat` / `cmd` 脚本
- 为脚本定义名称、Shell、描述和参数
- 异步执行脚本并记录输出
- 查看执行历史和执行详情

### 4. 数据备份

- 文件打包备份
- 数据库命令备份
- ES 命令备份
- 备份记录落 SQLite
- 备份产物可直接下载

### 5. 配置与持久化

- 主配置文件为 `config/config.yaml`
- 启动时会自动初始化 SQLite 表结构
- `applications` 保留在 YAML 中
- 其他主要配置段会同步到 SQLite `settings` 表
- 监控趋势、脚本执行记录、备份记录保存在 SQLite

## 技术架构

### 后端

- 语言：Go `1.25.3`
- Web 框架：`chi`
- 配置格式：YAML
- 本地数据库：SQLite（`modernc.org/sqlite`，纯 Go 驱动）
- 系统信息采集：`gopsutil`
- SNMP：`gosnmp`

### 前端

- 模板：`web/templates/index.html`
- 静态资源：`web/static/app.js`、`web/static/app.css`
- 不需要独立前端工程，也不需要 `npm install`

## 目录结构

```text
.
├── cmd/ops                 # 程序入口
├── config/config.yaml      # 主配置文件
├── internal/backup         # 备份任务管理
├── internal/config         # 配置加载、默认值、保存
├── internal/monitor        # 系统 / 协议 / 进程 / 端口采集
├── internal/script         # 脚本执行器
├── internal/store          # SQLite 持久化
├── internal/web            # HTTP 路由与页面/API 处理
├── scripts/build.ps1       # 多平台构建脚本
└── web                     # 页面模板与静态资源
```

## 运行要求

- Go `1.25.3`
- 可写目录权限：`config/`、`data/`、`backups/`、`scripts/`
- 若启用对应能力，还需要：
  - `nmap`
  - PowerShell（执行 `.ps1`）
  - 系统 shell，如 `sh` / `bash`
  - 被备份命令依赖，例如 `mysqldump`

## 快速启动

### 1. 安装依赖

```bash
go mod tidy
```

### 2. 启动服务

```bash
go run ./cmd/ops
```

启动后访问：

- 当前仓库内 `config/config.yaml` 默认监听 `http://127.0.0.1:18082`
- 如果 `config/config.yaml` 不存在，程序会自动生成默认配置，默认监听 `http://127.0.0.1:18081`

## 配置说明

配置文件路径固定为：

```text
config/config.yaml
```

核心配置示例：

```yaml
core:
  web:
    listen: 127.0.0.1:18082
  sqlite:
    path: data/ops-tool.db
    password: ops-fixed-password-2026
  timezone: Asia/Shanghai
```

主要配置段说明：

- `core`: Web 监听地址、SQLite 路径、时区
- `monitor`: 监控刷新间隔、启用项、SNMP、Nmap
- `applications`: 应用定义、进程名、端口、健康检查、日志文件
- `log_analysis`: 日志规则、日志源、最大返回行数
- `repair`: 脚本根目录与脚本定义
- `backup`: 备份目录、文件列表、数据库和 ES 命令
- `databases`: 数据库进程与端口检查目标
- `middleware`: HTTP / 端口 / 命令型中间件检查
- `extensions`: 扩展参数，例如备份保留数、默认日志查询条数

## 数据存储

默认 SQLite 路径：

```text
data/ops-tool.db
```

当前代码会自动初始化以下表：

- `settings`
- `script_runs`
- `backups`
- `monitor_trends`

其中：

- `settings` 保存从 YAML 同步过来的主要配置段
- `script_runs` 保存脚本执行记录与输出
- `backups` 保存备份任务状态
- `monitor_trends` 保存监控趋势采样

## 核心运行流程

1. 启动程序，解析运行目录并定位 `web/templates/index.html`
2. 加载 `config/config.yaml`，不存在则生成默认配置
3. 打开 SQLite，初始化表结构
4. 将配置同步到 SQLite `settings`
5. 启动 HTTP 服务
6. 后台周期采集监控快照并刷新趋势数据

## 主要 HTTP 接口

当前服务主要提供以下接口组：

- `/api/config`: 获取 / 更新配置
- `/api/monitor`: 获取实时监控快照
- `/api/monitor/trends`: 获取趋势数据
- `/api/processes/{pid}/detail`: 查看进程详情
- `/api/processes/{pid}/kill`: 结束进程
- `/api/logs/*`: 日志应用管理、检索、导出
- `/api/scripts/*`: 脚本上传、执行、历史查询
- `/api/backups/*`: 备份触发、列表、下载

## 构建

仓库内置 PowerShell 构建脚本：

```powershell
./scripts/build.ps1 -Version 0.1.0
```

默认输出：

- `dist/ops-tool-windows-amd64.exe`
- `dist/ops-tool-windows-arm64.exe`
- `dist/ops-tool-linux-amd64`
- `dist/ops-tool-linux-arm64`

## 开发说明

- 这是一个 Go 单体应用，没有独立前端打包流程
- 页面资源改动后，重启服务即可看到更新
- 运行目录需要能访问 `web/templates/index.html`，程序会用它判断项目根目录
- 当前仓库名称是 `ops-console`，但 Go module 和二进制名使用的是 `ops-tool`

## 已知注意点

- `go.mod` 指定 Go `1.25.3`，首次构建可能触发工具链下载
- Nmap、SNMP、脚本执行、数据库备份是否可用，取决于机器本地环境是否具备对应命令和权限
- 备份中的数据库 / ES 任务本质上是执行配置中的命令并将输出写入备份文件

## 适合补充的后续内容

如果后面需要继续完善 README，建议再补：

- 页面截图
- 各配置段的完整示例
- Windows / Linux 部署方式
- 常见备份命令模板
- 常见日志规则模板
