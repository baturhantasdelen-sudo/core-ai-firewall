# Sync production env vars to nexus-shield-dashboard Vercel project.
# Usage: powershell -File scripts/sync-vercel-env.ps1

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

$dashboardVars = @(
  "STRIPE_SECRET_KEY",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRO_MONTHLY_PRICE_ID",
  "STRIPE_PRO_YEARLY_PRICE_ID",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "GITHUB_APP_ID",
  "GITHUB_APP_PRIVATE_KEY",
  "GITHUB_WEBHOOK_SECRET",
  "NEXT_PUBLIC_GITHUB_APP_SLUG",
  "NEXT_PUBLIC_APP_URL"
)

function Read-DotEnv([string]$Path) {
  $map = @{}
  if (-not (Test-Path $Path)) { return $map }
  $content = Get-Content -Raw $Path
  foreach ($line in ($content -split "`n")) {
    $line = $line.Trim()
    if ($line -eq "" -or $line.StartsWith("#")) { continue }
    $eq = $line.IndexOf("=")
    if ($eq -lt 1) { continue }
    $key = $line.Substring(0, $eq).Trim()
    $val = $line.Substring($eq + 1).Trim()
    if ($val.StartsWith('"') -and $val.EndsWith('"')) {
      $val = $val.Substring(1, $val.Length - 2)
      $val = $val -replace '\\n', "`n"
    }
    if ($val -eq "[SENSITIVE]") { continue }
    $map[$key] = $val
  }
  return $map
}

function Get-VercelEnvValue([string]$Key) {
  $out = npx vercel@latest env pull .env.tmp-pull --environment=production --yes 2>&1
  if (-not (Test-Path ".env.tmp-pull")) { return $null }
  $pulled = Read-DotEnv ".env.tmp-pull"
  Remove-Item ".env.tmp-pull" -Force -ErrorAction SilentlyContinue
  if ($pulled.ContainsKey($Key) -and $pulled[$Key] -ne "[SENSITIVE]") {
    return $pulled[$Key]
  }
  return $null
}

function Set-VercelEnv([string]$Key, [string]$Val) {
  npx vercel@latest env add $Key production --value $Val --force --yes --sensitive 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to set $Key (exit $LASTEXITCODE)"
  }
}

# Ensure linked to dashboard project
$proj = Get-Content ".vercel\project.json" -Raw | ConvertFrom-Json
if ($proj.projectName -ne "nexus-shield-dashboard") {
  npx vercel@latest link --project nexus-shield-dashboard --yes 2>&1 | Out-Null
}

$localEnv = Read-DotEnv ".env.local"
$merged = @{}

foreach ($key in $dashboardVars) {
  if ($localEnv.ContainsKey($key) -and -not [string]::IsNullOrWhiteSpace($localEnv[$key])) {
    $merged[$key] = $localEnv[$key]
  }
}

# Pull Stripe vars from old nexus-shield project if missing
$needsStripePull = @(
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  "STRIPE_PRO_MONTHLY_PRICE_ID",
  "STRIPE_PRO_YEARLY_PRICE_ID"
) | Where-Object { -not $merged.ContainsKey($_) -or [string]::IsNullOrWhiteSpace($merged[$_]) }

if ($needsStripePull.Count -gt 0) {
  Write-Host "Pulling Stripe vars from nexus-shield project..."
  npx vercel@latest link --project nexus-shield --yes 2>&1 | Out-Null
  npx vercel@latest env pull .env.stripe-source --environment=production --yes 2>&1 | Out-Null
  $stripeEnv = Read-DotEnv ".env.stripe-source"
  foreach ($key in $needsStripePull) {
    if ($stripeEnv.ContainsKey($key)) { $merged[$key] = $stripeEnv[$key] }
  }
  # Prefer production webhook secret from old project over local stripe listen secret
  if ($stripeEnv.ContainsKey("STRIPE_WEBHOOK_SECRET")) {
    $merged["STRIPE_WEBHOOK_SECRET"] = $stripeEnv["STRIPE_WEBHOOK_SECRET"]
  }
  if ($stripeEnv.ContainsKey("STRIPE_SECRET_KEY")) {
    $merged["STRIPE_SECRET_KEY"] = $stripeEnv["STRIPE_SECRET_KEY"]
  }
  Remove-Item ".env.stripe-source" -Force -ErrorAction SilentlyContinue
  npx vercel@latest link --project nexus-shield-dashboard --yes 2>&1 | Out-Null
}

$merged["NEXT_PUBLIC_APP_URL"] = "https://nexus-shield-dashboard.vercel.app"

Write-Host "Syncing $($merged.Count) env vars to nexus-shield-dashboard (production)..."

foreach ($entry in $merged.GetEnumerator()) {
  $key = $entry.Key
  $val = $entry.Value
  if ([string]::IsNullOrWhiteSpace($val)) {
    Write-Host "SKIP (empty): $key"
    continue
  }
  Set-VercelEnv -Key $key -Val $val
  Write-Host "OK: $key"
}

Write-Host "Done. Redeploy with: npx vercel deploy --prod --yes"
