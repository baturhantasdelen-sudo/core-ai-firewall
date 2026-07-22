# Non-interactive GitHub Actions secret sync — reads .secrets.local.json
# Copy .secrets.local.json.example -> .secrets.local.json and fill values once.

$ErrorActionPreference = "Stop"
$env:PYTHONIOENCODING = "utf-8"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

$secretsFile = Join-Path $scriptDir ".secrets.local.json"
if (-not (Test-Path $secretsFile)) {
    Write-Host "HATA: $secretsFile bulunamadi." -ForegroundColor Red
    Write-Host "Ornek: Copy-Item .secrets.local.json.example .secrets.local.json" -ForegroundColor Yellow
    exit 1
}

$config = Get-Content $secretsFile -Raw | ConvertFrom-Json
$env:GITHUB_TOKEN = [string]$config.GITHUB_TOKEN
$env:REPO_OWNER = if ($config.REPO_OWNER) { [string]$config.REPO_OWNER } else { "baturhantasdelen-sudo" }

if (-not $env:GITHUB_TOKEN) {
    Write-Host "HATA: .secrets.local.json icinde GITHUB_TOKEN gerekli." -ForegroundColor Red
    exit 1
}

$sshKeyPath = Join-Path $env:USERPROFILE ".ssh\nexus_deploy"
if (Test-Path $sshKeyPath) {
    # Always prefer the on-disk deploy key over JSON (avoids broken escaped newlines in .secrets.local.json).
    $fileKey = (Get-Content $sshKeyPath -Raw).Replace("`r`n", "`n").Replace("`r", "`n").TrimEnd() + "`n"
    $config | Add-Member -NotePropertyName PROD_SSH_PRIVATE_KEY -NotePropertyValue $fileKey -Force
}

function Set-OneSecret {
    param([string]$Name, [string]$Value)
    if (-not $Value -or -not $Value.Trim()) {
        Write-Host "ATLA: $Name bos." -ForegroundColor Yellow
        return
    }
    $env:SECRET_VALUE = $Value
    python setup_github_secrets.py --name $Name
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    Remove-Item Env:\SECRET_VALUE -ErrorAction SilentlyContinue
}

Write-Host "`n=== GitHub Secrets (non-interactive) ===" -ForegroundColor Cyan
python check_github_secrets.py
Write-Host ""

foreach ($name in @("DOCKER_USERNAME", "DOCKER_PASSWORD", "PROD_SERVER_IP", "PROD_SERVER_USER", "PROD_SSH_PRIVATE_KEY", "CLOUDFLARE_TUNNEL_TOKEN", "PROD_PUBLIC_URL", "API_KEY_SECRET")) {
    Set-OneSecret -Name $name -Value ([string]$config.$name)
}

Write-Host "`nSon durum:" -ForegroundColor Cyan
python check_github_secrets.py

Remove-Item Env:\GITHUB_TOKEN, Env:\REPO_OWNER, Env:\SECRET_VALUE -ErrorAction SilentlyContinue
Write-Host "`nSecret senkronizasyonu tamamlandi." -ForegroundColor Green
