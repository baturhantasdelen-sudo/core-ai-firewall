#!/usr/bin/env bash
# Set CLOUDFLARE_WEB_ANALYTICS_TOKEN in production .env and restart Fast API.
#
# Token: Cloudflare Dashboard → Web Analytics → Manage site → JS snippet token
# Usage:
#   CLOUDFLARE_WEB_ANALYTICS_TOKEN='your-token' sudo -E bash scripts/activate_cloudflare_analytics.sh
set -euo pipefail

DEPLOY_PATH="${DEPLOY_PATH:-/opt/nexus-core-firewall}"
TOKEN="${CLOUDFLARE_WEB_ANALYTICS_TOKEN:-}"

if [[ -z "$TOKEN" ]]; then
  echo "ERROR: Set CLOUDFLARE_WEB_ANALYTICS_TOKEN (from Cloudflare Web Analytics → Manage site)" >&2
  exit 1
fi

cd "$DEPLOY_PATH"

if [[ -f .env ]]; then
  grep -v '^CLOUDFLARE_WEB_ANALYTICS_TOKEN=' .env > .env.tmp || true
  mv .env.tmp .env
fi
echo "CLOUDFLARE_WEB_ANALYTICS_TOKEN=${TOKEN}" >> .env

docker compose --env-file .env -f docker-compose.prod.yml up -d nexus-shield-api

echo "Cloudflare Web Analytics token applied. Verify:"
echo "  curl -s http://127.0.0.1:8080/analytics-config.js | grep cloudflareToken"
