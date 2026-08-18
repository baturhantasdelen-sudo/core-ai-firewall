#!/usr/bin/env bash
# deploy-vercel-dashboard.sh — deploy Nexus Shield dashboard to Vercel (production)
#
# Prerequisites:
#   npm i -g vercel
#   vercel login
#   Vercel project linked: nexus-shield-dashboard
#
# Required Vercel Production env vars:
#   NEXT_PUBLIC_APP_URL=https://nexusshield.ai
#   NEXT_PUBLIC_API_URL=https://api.nexusshield.ai
#   NEXUS_SHIELD_API_URL=https://api.nexusshield.ai
#
# Usage:
#   cd nexus-shield-dashboard
#   bash ../scripts/deploy-vercel-dashboard.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DASHBOARD="${ROOT}/nexus-shield-dashboard"

log() { echo "[vercel-deploy] $*"; }

[[ -d "$DASHBOARD" ]] || { log "ERROR: dashboard dir not found"; exit 1; }

if ! command -v vercel >/dev/null 2>&1; then
  log "ERROR: vercel CLI not installed (npm i -g vercel)"
  exit 1
fi

cd "$DASHBOARD"

log "Production env check (remote)"
vercel env ls production 2>/dev/null | grep -E 'NEXT_PUBLIC_API_URL|NEXUS_SHIELD_API_URL|NEXT_PUBLIC_APP_URL' || \
  log "WARN: set NEXT_PUBLIC_API_URL and NEXUS_SHIELD_API_URL=https://api.nexusshield.ai in Vercel"

log "Deploying to Vercel production..."
vercel deploy --prod --yes

log "Done. Verify: https://nexus-shield-dashboard.vercel.app"
