# Run Nexus Shield Trust Hub demo recordings (Playwright / Chromium).
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location (Join-Path $Root "demos")

# GCP: use 3001 if Grafana occupies 3000
if (-not $env:TRUST_HUB_URL) { $env:TRUST_HUB_URL = "http://127.0.0.1:3000/dashboard/trust-hub" }
if (-not $env:DEMO_HEADLESS) { $env:DEMO_HEADLESS = "1" }
if (-not $env:API_BASE_URL) { $env:API_BASE_URL = "http://127.0.0.1:8080" }

if (-not (Test-Path "node_modules")) {
  npm install
}

npm run install:browsers
npm run demos

Write-Host "Videos saved under $(Join-Path $Root 'demos/videos')"
