param(
    [string]$Version = "dev",
    [switch]$EnableTrafficCapture
)

$ErrorActionPreference = "Stop"

if (-not $env:GOPROXY -or [string]::IsNullOrWhiteSpace($env:GOPROXY)) {
    $env:GOPROXY = "https://goproxy.cn,direct"
}

$npmCmd = Get-Command npm -ErrorAction SilentlyContinue
if (-not $npmCmd) {
    throw "npm command not found. Please install Node.js/npm first."
}

Write-Host "building frontend assets with Svelte ..."
Push-Location "frontend"
try {
    if (Test-Path "package-lock.json") {
        npm ci
    } else {
        npm install
    }
    npm run build
} finally {
    Pop-Location
}

$targets = @(
    @{ GOOS = "windows"; GOARCH = "amd64"; EXT = ".exe" },
    @{ GOOS = "windows"; GOARCH = "arm64"; EXT = ".exe" },
    @{ GOOS = "linux"; GOARCH = "amd64"; EXT = "" },
    @{ GOOS = "linux"; GOARCH = "arm64"; EXT = "" }
)

New-Item -ItemType Directory -Force -Path "dist" | Out-Null

foreach ($t in $targets) {
    $useCGO = $false
    if ($EnableTrafficCapture -and $t.GOOS -eq "windows" -and $t.GOARCH -eq "amd64") {
        if (Test-Path "C:\Windows\System32\wpcap.dll") {
            $useCGO = $true
        } else {
            Write-Warning "wpcap.dll not found, fallback to CGO_ENABLED=0 for $($t.GOOS)-$($t.GOARCH)"
        }
    }

    $env:CGO_ENABLED = $(if ($useCGO) { "1" } else { "0" })
    $env:GOOS = $t.GOOS
    $env:GOARCH = $t.GOARCH

    $out = "dist/ops-tool-$($t.GOOS)-$($t.GOARCH)$($t.EXT)"
    Write-Host "building $out (CGO_ENABLED=$($env:CGO_ENABLED)) ..."
    go build -trimpath -ldflags "-s -w -X main.version=$Version" -o $out ./cmd/ops
}

Write-Host "build done in ./dist"
