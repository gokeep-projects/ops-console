param(
    [string]$GoProxy = "https://goproxy.cn,direct",
    [string]$Listen = "0.0.0.0:18082"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path "C:\Windows\System32\wpcap.dll")) {
    throw "未检测到 wpcap.dll。请先安装 Npcap/Win10Pcap 后再运行（需要抓包能力）。"
}

$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
$isAdmin = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Warning "当前非管理员权限。连接列表可用，但抓包启动可能失败（建议以管理员身份运行 PowerShell）。"
}

$env:GOPROXY = $GoProxy
$env:CGO_ENABLED = "1"
$env:GOOS = "windows"
$env:GOARCH = "amd64"
$env:OPS_LISTEN = $Listen

Write-Host "已启用 CGO 抓包模式，正在启动服务..."
Write-Host "GOPROXY=$($env:GOPROXY)"
Write-Host "CGO_ENABLED=$($env:CGO_ENABLED)"

go run ./cmd/ops
