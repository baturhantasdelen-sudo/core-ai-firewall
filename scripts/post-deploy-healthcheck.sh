#!/usr/bin/env bash
# post-deploy-healthcheck.sh — verify nginx, API, and cloudflared after deploy
#
# Usage (production server):
#   cd /opt/nexus-core-firewall
#   bash scripts/post-deploy-healthcheck.sh

set -euo pipefail

DEPLOY_PATH="${DEPLOY_PATH:-/opt/nexus-core-firewall}"
cd "$DEPLOY_PATH"

log() { echo "[healthcheck] $*"; }

log "1/4 Container status"
docker ps --format 'table {{.Names}}\t{{.Status}}' | grep -E 'nginx-gateway|cloudflared|nexus-shield-api|nexus-api' || true

log "2/4 Fast API direct (:8080 /healthz)"
curl -fsS http://127.0.0.1:8080/healthz | grep -q HEALTHY

log "3/4 Nginx gateway (:80 /healthz)"
curl -fsS http://127.0.0.1:80/healthz | grep -q HEALTHY

log "4/4 Landing page marker"
curl -fsS http://127.0.0.1:80/ | grep -q '<title>'

if docker ps --format '{{.Names}}' | grep -q '^cloudflared-prod$'; then
  _cf_status=$(docker inspect cloudflared-prod --format '{{.State.Status}}')
  log "cloudflared-prod status: ${_cf_status}"
  docker inspect cloudflared-prod --format 'NetworkMode={{.HostConfig.NetworkMode}}'
else
  log "WARN: cloudflared-prod is not running (check CLOUDFLARE_TUNNEL_TOKEN)"
fi

log "OK — post-deploy healthcheck passed"
