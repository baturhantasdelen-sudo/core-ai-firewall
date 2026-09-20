# Publish harness/ to https://github.com/nexusshield/harness
# Requires: gh auth login as the nexusshield GitHub user (not a collaborator account).

$ErrorActionPreference = "Stop"
$HarnessRoot = Split-Path $PSScriptRoot -Parent
$TempDir = Join-Path $env:TEMP "nexusshield-harness-publish"

Write-Host "Copying clean harness tree to $TempDir ..."
if (Test-Path $TempDir) { Remove-Item -Recurse -Force $TempDir }
New-Item -ItemType Directory -Path $TempDir | Out-Null

$exclude = @('node_modules', 'dist', '.env', '.env.local', 'results')
Get-ChildItem $HarnessRoot -Force | Where-Object { $exclude -notcontains $_.Name } | ForEach-Object {
  Copy-Item $_.FullName -Destination (Join-Path $TempDir $_.Name) -Recurse -Force
}

Set-Location $TempDir
if (-not (Test-Path .git)) { git init | Out-Null }
git config user.name "Nexus Shield"
git config user.email "opensource@nexusshield.ai"
git add .
git commit -m "feat: initial open-source agent security benchmark harness"
if ($LASTEXITCODE -ne 0) { throw "git commit failed in publish temp repo" }

$activeLogin = gh api user --jq .login
if ($activeLogin -ne "nexusshield") {
  throw "gh is logged in as '$activeLogin'. Run: gh auth login  (select the nexusshield account), then re-run this script."
}

Write-Host "Creating public repo nexusshield/harness ..."
gh repo create nexusshield/harness --public --source=. --remote=origin --push --description "Open-source agent runtime security benchmark harness for MCP tool chains and LLM agents"

Write-Host "Done. Verify: https://github.com/nexusshield/harness"
