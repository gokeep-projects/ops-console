param(
    [string]$Version = "dev"
)

$ErrorActionPreference = "Stop"

$targets = @(
    @{ GOOS = "windows"; GOARCH = "amd64"; EXT = ".exe" },
    @{ GOOS = "windows"; GOARCH = "arm64"; EXT = ".exe" },
    @{ GOOS = "linux"; GOARCH = "amd64"; EXT = "" },
    @{ GOOS = "linux"; GOARCH = "arm64"; EXT = "" }
)

New-Item -ItemType Directory -Force -Path "dist" | Out-Null

foreach ($t in $targets) {
    $env:CGO_ENABLED = "0"
    $env:GOOS = $t.GOOS
    $env:GOARCH = $t.GOARCH

    $out = "dist/ops-tool-$($t.GOOS)-$($t.GOARCH)$($t.EXT)"
    Write-Host "building $out ..."
    go build -trimpath -ldflags "-s -w -X main.version=$Version" -o $out ./cmd/ops
}

Write-Host "build done in ./dist"
