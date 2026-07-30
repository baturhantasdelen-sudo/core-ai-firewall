# Rebuild and start Nexus Shield Fast stack with live .py reload (no stale cache).
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

Write-Host "==> Building Fast API image (no cache)..."
docker compose -f docker-compose.fast.yml build --no-cache nexus-shield-api

Write-Host "==> Starting redis + nexus-shield-api on :8080..."
docker compose -f docker-compose.fast.yml up -d --force-recreate

Write-Host "==> Waiting for healthcheck..."
for ($i = 1; $i -le 30; $i++) {
    try {
        $null = Invoke-WebRequest -Uri "http://127.0.0.1:8080/healthz" -UseBasicParsing -TimeoutSec 2
        Write-Host "OK — Fast API healthy at http://localhost:8080"
        Write-Host "Dashboard: http://localhost:8080/dashboard"
        exit 0
    } catch {
        Start-Sleep -Seconds 1
    }
}

Write-Host "WARN — healthcheck timed out; check: docker compose -f docker-compose.fast.yml logs nexus-shield-api"
exit 1
