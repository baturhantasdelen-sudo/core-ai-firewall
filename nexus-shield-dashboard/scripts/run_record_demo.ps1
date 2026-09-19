# run_record_demo.ps1 — one-shot growth demo recording
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  Write-Error "npm not found"
}

Write-Host "[record] Installing dependencies if needed..."
npm install --silent 2>$null

Write-Host "[record] Ensuring Playwright Chromium..."
npm run record:browsers

$health = try {
  (Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing -TimeoutSec 3).StatusCode
} catch { $null }

if ($health -ne 200) {
  Write-Warning "Dashboard not detected on http://localhost:3000 — start with: npm run dev"
  Write-Warning "Continuing anyway (recording may fail if server is down)."
}

npm run record:demo
