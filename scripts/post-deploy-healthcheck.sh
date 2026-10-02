#!/usr/bin/env bash
# post-deploy-healthcheck.sh — verify nginx, API, and cloudflared after deploy
#
# Usage (production server):
#   cd /opt/nexus-core-firewall
#   bash scripts/post-deploy-healthcheck.sh

set -euo pipefail

DEPLOY_PATH="${DEPLOY_PATH:-/opt/nexus-core-firewall}"
cd "$DEPLOY_PATH"

DEPLOY_ML_IMAGE="${DEPLOY_ML_IMAGE:-0}"
if [[ -f .env ]]; then
  DEPLOY_ML_IMAGE="$(grep '^DEPLOY_ML_IMAGE=' .env 2>/dev/null | cut -d= -f2- || echo "${DEPLOY_ML_IMAGE}")"
fi

log() { echo "[healthcheck] $*"; }

wait_http() {
  local url="$1"
  local pattern="${2:-HEALTHY}"
  local attempts="${3:-45}"
  for ((i = 1; i <= attempts; i++)); do
    if curl -fsS "${url}" 2>/dev/null | grep -q "${pattern}"; then
      return 0
    fi
    sleep 2
  done
  log "TIMEOUT waiting for ${url}"
  return 1
}

log "1/4 Container status"
docker ps --format 'table {{.Names}}\t{{.Status}}' | grep -E 'nginx-gateway|cloudflared|nexus-shield-api|nexus-api' || true

log "2/4 Fast API direct (:8080 /healthz)"
wait_http "http://127.0.0.1:8080/healthz" HEALTHY 30

log "3/5 Nginx gateway (liveness /nginx-live, then proxied /healthz + API routes)"
wait_http "http://127.0.0.1:80/nginx-live" OK 20
wait_http "http://127.0.0.1:80/healthz" HEALTHY 45
curl -fsS http://127.0.0.1:80/healthz | grep -q HEALTHY
curl -fsS http://127.0.0.1:80/api/health | grep -q HEALTHY
curl -fsS http://127.0.0.1:80/api/v1/health | grep -q '"healthy":true'

if docker ps --format '{{.Names}}' | grep -q '^nexus-api-prod$'; then
  log "4/5 ML API direct (container /healthz)"
  docker exec nexus-api-prod curl -fsS http://127.0.0.1:8000/healthz | grep -q HEALTHY
else
  log "4/5 ML API skipped (lightweight deploy, DEPLOY_ML_IMAGE=${DEPLOY_ML_IMAGE})"
fi

log "5/5 Landing page marker"
curl -fsS http://127.0.0.1:80/ | grep -q 'sandbox-v3'
curl -fsS http://127.0.0.1:80/ | grep -q '/api/sandbox'
curl -fsS http://127.0.0.1:80/ | grep -q '<title>'

if docker ps --format '{{.Names}}' | grep -q '^cloudflared-prod$'; then
  _cf_status=$(docker inspect cloudflared-prod --format '{{.State.Status}}')
  log "cloudflared-prod status: ${_cf_status}"
  docker inspect cloudflared-prod --format 'NetworkMode={{.HostConfig.NetworkMode}}'
else
  log "WARN: cloudflared-prod is not running (check CLOUDFLARE_TUNNEL_TOKEN)"
fi

log "OK — post-deploy healthcheck passed"
