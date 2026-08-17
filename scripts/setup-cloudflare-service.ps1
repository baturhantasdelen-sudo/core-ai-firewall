# setup-cloudflare-service.ps1 — Local Windows dev: cloudflared + tunnel keepalive
#
# Usage:
#   $env:CLOUDFLARE_TUNNEL_TOKEN = "eyJ..."
#   .\scripts\setup-cloudflare-service.ps1
#
# Requires: cloudflared in PATH (winget install Cloudflare.cloudflared)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $RepoRoot

function Log($msg) { Write-Host "[setup-cloudflare] $(Get-Date -Format o) $msg" }

Log "1/4 Check cloudflared"
if (-not (Get-Command cloudflared -ErrorAction SilentlyContinue)) {
  Write-Host "Install cloudflared: winget install Cloudflare.cloudflared"
  exit 1
}
cloudflared --version

Log "2/4 Dev env defaults"
$env:LOCAL_HEALTH_URL = if ($env:LOCAL_HEALTH_URL) { $env:LOCAL_HEALTH_URL } else { "http://127.0.0.1:3000/api/health" }
$env:CLOUDFLARED_MODE = "process"
if (-not $env:CLOUDFLARE_TUNNEL_TOKEN) {
  Write-Host "Set CLOUDFLARE_TUNNEL_TOKEN before running (Cloudflare Zero Trust → Tunnels → token)."
}

Log "3/4 Config reference: deploy/cloudflared/config.yml"
Get-Content "$RepoRoot\deploy\cloudflared\config.yml" | Select-Object -First 20

Log "4/4 Start dev stack with tunnel keepalive"
Write-Host @"

Run in separate terminals OR use npm run dev:tunnel from repo root:

  npm install
  npm run dev:tunnel

Manual:
  cd nexus-shield-dashboard && npm run dev
  node scripts/tunnel-keepalive.js

Cloudflare Public Hostname (dev quick tunnel):
  Service URL -> http://127.0.0.1:3000  (dashboard) OR http://127.0.0.1:8080 (Fast API)

"@
