# Full CI/CD orchestrator: secrets -> empty commit -> push -> monitor -> verify
param(
    [switch]$SkipSecrets,
    [switch]$SkipPush,
    [int]$PollMinutes = 20
)

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir
$git = "C:\Program Files\Git\cmd\git.exe"

Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process -Force

function Get-LatestRun {
    $uri = "https://api.github.com/repos/baturhantasdelen-sudo/core-ai-firewall/actions/runs?per_page=1"
    $headers = @{ Accept = "application/vnd.github+json"; "User-Agent" = "nexus-ci-orchestrator" }
    return (Invoke-RestMethod -Uri $uri -Headers $headers)
}

function Wait-Workflow {
    param([int]$Minutes)
    $deadline = (Get-Date).AddMinutes($Minutes)
    $lastStatus = ""
    while ((Get-Date) -lt $deadline) {
        $run = (Get-LatestRun).workflow_runs[0]
        $status = "$($run.status)|$($run.conclusion)|$($run.head_sha.Substring(0,7))"
        if ($status -ne $lastStatus) {
            Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Run #$($run.run_number) $($run.display_title) -> $($run.status) / $($run.conclusion)" -ForegroundColor Cyan
            $lastStatus = $status
        }
        if ($run.status -eq "completed") {
            return $run
        }
        Start-Sleep -Seconds 20
    }
    throw "Workflow $($Minutes) dakika icinde tamamlanmadi."
}

function Get-RunJobs {
    param([long]$RunId)
    $uri = "https://api.github.com/repos/baturhantasdelen-sudo/core-ai-firewall/actions/runs/$RunId/jobs"
    $headers = @{ Accept = "application/vnd.github+json"; "User-Agent" = "nexus-ci-orchestrator" }
    return (Invoke-RestMethod -Uri $uri -Headers $headers).jobs
}

Write-Host "`n=== Nexus CI Orchestrator ===" -ForegroundColor White

if (-not $SkipSecrets) {
    if (Test-Path (Join-Path $scriptDir ".secrets.local.json")) {
        & "$scriptDir\run_setup_github_secrets_auto.ps1"
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    }
    else {
        Write-Host "UYARI: .secrets.local.json yok — secret adimi atlandi." -ForegroundColor Yellow
        Write-Host "       Copy-Item .secrets.local.json.example .secrets.local.json" -ForegroundColor DarkGray
    }
}

if (-not $SkipPush) {
    & $git add -A 2>$null
    & $git commit --allow-empty -m "ci: infrastructure synced and secrets updated via Cursor"
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    & $git push origin main
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    Write-Host "Push tamamlandi; workflow tetiklendi." -ForegroundColor Green
    Start-Sleep -Seconds 8
}

Write-Host "`nWorkflow izleniyor (max $PollMinutes dk)..." -ForegroundColor Cyan
$completedRun = Wait-Workflow -Minutes $PollMinutes
$jobs = Get-RunJobs -RunId $completedRun.id

Write-Host "`n=== Job Ozeti ===" -ForegroundColor White
foreach ($job in $jobs) {
    $color = if ($job.conclusion -eq "success") { "Green" } elseif ($job.conclusion -eq "skipped") { "DarkGray" } else { "Red" }
    Write-Host "$($job.name): $($job.conclusion)" -ForegroundColor $color
    foreach ($step in ($job.steps | Where-Object { $_.conclusion -eq "failure" })) {
        Write-Host "  FAIL: $($step.name)" -ForegroundColor Red
    }
}

if ($completedRun.conclusion -ne "success") {
    Write-Host "`nPipeline basarisiz: $($completedRun.html_url)" -ForegroundColor Red
    exit 1
}

$serverIp = $env:PROD_SERVER_IP
if (-not $serverIp -and (Test-Path (Join-Path $scriptDir ".secrets.local.json"))) {
    $cfg = Get-Content (Join-Path $scriptDir ".secrets.local.json") -Raw | ConvertFrom-Json
    $serverIp = [string]$cfg.PROD_SERVER_IP
}

if (-not $serverIp) {
    Write-Host "PROD_SERVER_IP yok; verify_production_server.ps1 atlandi." -ForegroundColor Yellow
    exit 0
}

$sshUser = if ($env:PROD_SERVER_USER) { $env:PROD_SERVER_USER } else { "ubuntu" }
Write-Host "`nProduction dogrulama: $serverIp" -ForegroundColor Cyan
& "$scriptDir\verify_production_server.ps1" -ServerIp $serverIp -SshUser $sshUser
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

try {
    $health = Invoke-RestMethod -Uri "http://${serverIp}/healthz" -TimeoutSec 30
    Write-Host "[OK] HTTP /healthz: $health" -ForegroundColor Green
}
catch {
    Write-Host "[FAIL] HTTP /healthz erisilemedi: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host "`nTum adimlar basarili." -ForegroundColor Green
