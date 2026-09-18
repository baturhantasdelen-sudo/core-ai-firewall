#Requires -Version 5.1
<#
.SYNOPSIS
  AI Enterprise Stack — Windows Enterprise Installer
.DESCRIPTION
  Zero-friction provisioning: prerequisites, .env bootstrap, Docker deploy, health check.
#>
param(
    [switch]$SkipHealthCheck,
    [switch]$NonInteractive
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path $PSScriptRoot -Parent
Set-Location $ProjectRoot

function Write-Step([string]$Message) {
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Write-Ok([string]$Message) {
    Write-Host "[OK]   $Message" -ForegroundColor Green
}

function Write-Warn([string]$Message) {
    Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

function Write-Err([string]$Message) {
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

function Test-CommandExists([string]$Name) {
    return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Read-ConfigValue([string]$Prompt, [string]$Default) {
    if ($NonInteractive) { return $Default }
    $input = Read-Host "$Prompt [$Default]"
    if ([string]::IsNullOrWhiteSpace($input)) { return $Default }
    return $input.Trim()
}

function Set-EnvFileValue([string]$FilePath, [string]$Key, [string]$Value) {
    $lines = @()
    if (Test-Path $FilePath) {
        $lines = Get-Content $FilePath -Encoding UTF8
    }
    $updated = $false
    $newLines = foreach ($line in $lines) {
        if ($line -match "^\s*$([regex]::Escape($Key))\s*=") {
            $updated = $true
            "$Key=$Value"
        } else {
            $line
        }
    }
    if (-not $updated) {
        $newLines += "$Key=$Value"
    }
    $newLines | Set-Content -Path $FilePath -Encoding UTF8
}

function Wait-HealthCheck([string]$Url, [int]$TimeoutSeconds = 30) {
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
            if ($response.StatusCode -eq 200) {
                return $true
            }
        } catch {
            Start-Sleep -Seconds 2
        }
    }
    return $false
}

function Show-SuccessBanner() {
    $banner = @"

  ====================================================================
       AI ENTERPRISE STACK — DEPLOYMENT SUCCESSFUL
  ====================================================================

   API Gateway (NexusShield + ResoNet)
     Health  : http://localhost:8080/healthz
     Swagger : http://localhost:8080/docs
     Nexus   : http://localhost:8080/nexus/v1/chat/completions
     ResoNet : http://localhost:8080/resonet/v1/chat/completions

   Command Center (Docker single-port proxy)
     Dashboard: http://localhost:8080/dashboard/

   Native dual-port dev (optional, separate terminal):
     Dashboard: http://localhost:8501
     Script   : powershell -File scripts\run_dashboard.ps1

   Operations:
     Logs   : docker compose logs -f ai-gateway
     Stop   : docker compose down
     Status : docker compose ps

  ====================================================================
"@
    Write-Host $banner -ForegroundColor Green
}

Write-Host ""
Write-Host "  AI Enterprise Stack — Enterprise Installer (Windows)" -ForegroundColor White
Write-Host "  Project: $ProjectRoot"

# --- 1. Prerequisites ---
Write-Step "Checking prerequisites"

if (-not (Test-CommandExists "docker")) {
    Write-Err "Docker is not installed. Install Docker Desktop: https://docs.docker.com/desktop/setup/install/windows-install/"
    exit 1
}

try {
    docker info *> $null
    Write-Ok "Docker daemon is running"
} catch {
    Write-Err "Docker is installed but not running. Start Docker Desktop and retry."
    exit 1
}

if (Test-CommandExists "docker") {
    $composeVersion = docker compose version 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Ok "Docker Compose available ($composeVersion)"
    } else {
        Write-Err "Docker Compose v2 plugin not found. Update Docker Desktop."
        exit 1
    }
}

if (Test-CommandExists "ollama") {
    try {
        $ollamaVersion = ollama --version 2>$null
        Write-Ok "Ollama CLI detected ($ollamaVersion)"
    } catch {
        Write-Warn "Ollama CLI found but version check failed"
    }
    try {
        Invoke-WebRequest -Uri "http://localhost:11434/api/tags" -UseBasicParsing -TimeoutSec 3 | Out-Null
        Write-Ok "Ollama API reachable at http://localhost:11434"
    } catch {
        Write-Warn "Ollama not reachable on :11434 — start with: ollama serve"
    }
} else {
    Write-Warn "Ollama not in PATH — ResoNet local routing will fail until Ollama is installed"
}

# --- 2. Environment configuration ---
Write-Step "Configuring environment (.env)"

$envFile = Join-Path $ProjectRoot ".env"
$envExample = Join-Path $ProjectRoot ".env.example"

if (Test-Path $envFile) {
    Write-Ok "Existing .env found — preserving active configuration (no overwrite)"
} else {
    if (-not (Test-Path $envExample)) {
        Write-Err ".env.example not found at $envExample"
        exit 1
    }
    Copy-Item $envExample $envFile
    Write-Ok "Created .env from .env.example"

    $apiKey = Read-ConfigValue "Enter OPENAI_API_KEY" "sk-your-openai-api-key"
    $gridRegion = Read-ConfigValue "Enter GRID_CARBON_REGION (global, us, eu, tr, ...)" "global"
    $compressionThreshold = Read-ConfigValue "Enter RESONET_COMPRESSION_TOKEN_THRESHOLD" "200"

    Set-EnvFileValue $envFile "OPENAI_API_KEY" $apiKey
    Set-EnvFileValue $envFile "GRID_CARBON_REGION" $gridRegion
    Set-EnvFileValue $envFile "RESONET_COMPRESSION_TOKEN_THRESHOLD" $compressionThreshold
    Set-EnvFileValue $envFile "STREAMLIT_ENABLED" "true"
    Set-EnvFileValue $envFile "TELEMETRY_DB_PATH" "/app/data/telemetry.db"
    Write-Ok "Interactive .env values saved"
}

# --- 3. Data directory ---
Write-Step "Preparing persistent data directory"

$dataDir = Join-Path $ProjectRoot "data"
if (-not (Test-Path $dataDir)) {
    New-Item -ItemType Directory -Path $dataDir | Out-Null
    Write-Ok "Created ./data directory"
} else {
    Write-Ok "./data directory exists"
}

try {
    $testFile = Join-Path $dataDir ".write_test"
    "ok" | Set-Content $testFile -Encoding ASCII
    Remove-Item $testFile -Force
    Write-Ok "Write permissions verified on ./data"
} catch {
    Write-Err "Cannot write to ./data — check folder permissions"
    exit 1
}

# --- 4. Docker build & deploy ---
Write-Step "Building and starting containers (docker compose up -d --build)"

docker compose up -d --build
if ($LASTEXITCODE -ne 0) {
    Write-Err "docker compose up failed — run: docker compose logs ai-gateway"
    exit 1
}
Write-Ok "Containers started"

# --- 5. Health check ---
if (-not $SkipHealthCheck) {
    Write-Step "Waiting for API health check (http://localhost:8080/healthz)"
    if (Wait-HealthCheck "http://localhost:8080/healthz" 30) {
        Write-Ok "Health check passed (HTTP 200)"
    } else {
        Write-Warn "Health check timed out after 30s — service may still be starting"
        Write-Warn "Inspect logs: docker compose logs -f ai-gateway"
    }
}

Show-SuccessBanner
exit 0
