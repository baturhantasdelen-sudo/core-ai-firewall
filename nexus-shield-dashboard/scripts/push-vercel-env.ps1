# Push .env.local values to nexus-shield-dashboard Vercel production env.
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

function Invoke-Vercel([string[]]$Args) {
  $prev = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  & npx vercel@latest @Args 2>&1 | Out-Null
  $code = $LASTEXITCODE
  $ErrorActionPreference = $prev
  if ($code -ne 0) { throw "vercel exit ${code}: $($Args -join ' ')" }
}

Invoke-Vercel @("link", "--project", "nexus-shield-dashboard", "--yes")

$keys = @(
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "GITHUB_APP_ID",
  "GITHUB_APP_PRIVATE_KEY",
  "GITHUB_WEBHOOK_SECRET",
  "NEXT_PUBLIC_GITHUB_APP_SLUG"
)

function Read-DotEnv([string]$Path) {
  $map = @{}
  if (-not (Test-Path $Path)) { return $map }
  $raw = Get-Content -Raw $Path
  foreach ($line in ($raw -split "`r?`n")) {
    $line = $line.Trim()
    if ($line -eq "" -or $line.StartsWith("#")) { continue }
    $eq = $line.IndexOf("=")
    if ($eq -lt 1) { continue }
    $key = $line.Substring(0, $eq).Trim()
    $val = $line.Substring($eq + 1).Trim()
    if ($val.StartsWith('"') -and $val.EndsWith('"')) {
      $val = $val.Substring(1, $val.Length - 2) -replace '\\n', "`n"
    }
    $map[$key] = $val
  }
  return $map
}

$envMap = Read-DotEnv ".env.local"
$envMap["NEXT_PUBLIC_APP_URL"] = "https://nexus-shield-dashboard.vercel.app"

foreach ($key in $keys) {
  if (-not $envMap.ContainsKey($key) -or [string]::IsNullOrWhiteSpace($envMap[$key])) {
    Write-Host "SKIP (missing): $key"
    continue
  }
  $val = $envMap[$key]
  Write-Host "Setting $key..."
  Invoke-Vercel @("env", "add", $key, "production", "--value", $val, "--force", "--yes", "--sensitive")
  Write-Host "OK: $key"
}

Write-Host "Setting NEXT_PUBLIC_APP_URL..."
Invoke-Vercel @("env", "add", "NEXT_PUBLIC_APP_URL", "production", "--value", "https://nexus-shield-dashboard.vercel.app", "--force", "--yes")
Write-Host "OK: NEXT_PUBLIC_APP_URL"
Write-Host "Done."
