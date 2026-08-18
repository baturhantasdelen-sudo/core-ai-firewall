#!/usr/bin/env bash
# setup-unified-api-domain.sh — api.nexusshield.ai = Vercel UI (/) + Python API (/api/*)
#
# Usage (production — Docker stack at /opt/nexus-core-firewall):
#   cd /opt/nexus-core-firewall
#   sudo bash scripts/setup-unified-api-domain.sh
#
# Optional host nginx (only when Docker nginx-gateway is NOT on :80):
#   USE_HOST_NGINX=1 sudo bash scripts/setup-unified-api-domain.sh

set -euo pipefail

DEPLOY_PATH="${DEPLOY_PATH:-/opt/nexus-core-firewall}"
USE_HOST_NGINX="${USE_HOST_NGINX:-0}"
cd "$DEPLOY_PATH"

log() { echo "[setup-unified] $*"; }
fail() { log "ERROR: $*"; exit 1; }

[[ -f docker-compose.prod.yml ]] || fail "docker-compose.prod.yml not found in ${DEPLOY_PATH}"
[[ -f nginx.conf ]] || fail "nginx.conf missing"

log "1/5 Verify Cloudflare Tunnel origin -> http://127.0.0.1:80"
if docker ps --format '{{.Names}}' | grep -q '^cloudflared-prod$'; then
  log "cloudflared-prod running (token mode). Zero Trust panel: Service URL = http://127.0.0.1:80"
elif systemctl is-active --quiet cloudflared 2>/dev/null; then
  log "systemd cloudflared detected — ensure ExecStart uses http://127.0.0.1:80 NOT :8000/:8080"
  log "  sudo systemctl edit --full cloudflared"
  log "  sudo systemctl daemon-reload && sudo systemctl restart cloudflared"
else
  log "WARN: cloudflared not running — start with: sudo bash scripts/start-tunnel.sh"
fi

if [[ "$USE_HOST_NGINX" == "1" ]]; then
  log "2/5 Install host nginx (USE_HOST_NGINX=1)"
  if ! command -v nginx >/dev/null 2>&1; then
    sudo apt-get update -qq
    sudo apt-get install -y nginx
  fi
  sudo cp deploy/nginx/nexus-shield.conf /etc/nginx/sites-available/nexus-shield
  sudo ln -sf /etc/nginx/sites-available/nexus-shield /etc/nginx/sites-enabled/nexus-shield
  sudo rm -f /etc/nginx/sites-enabled/default
  sudo nginx -t
  sudo systemctl enable nginx
  sudo systemctl restart nginx
  log "Host nginx active on :80"
else
  log "2/5 Reload Docker nginx-gateway (:80)"
  docker compose --env-file .env -f docker-compose.prod.yml up -d nginx-gateway nexus-api nexus-shield-api
  docker compose --env-file .env -f docker-compose.prod.yml restart nginx-gateway
fi

log "3/5 Wait for ML API (/api/health via container)"
for _ in $(seq 1 12); do
  if docker exec nexus-api-prod curl -fsS http://127.0.0.1:8000/api/health 2>/dev/null | grep -q '"status"'; then
    break
  fi
  if docker exec nexus-api-prod curl -fsS http://127.0.0.1:8000/healthz 2>/dev/null | grep -q HEALTHY; then
    log "WARN: /api/health missing on image — redeploy nexus-api with latest nexus_shield_api.py"
    break
  fi
  sleep 10
done

log "4/5 Verify nginx routing (:80)"
curl -fsS http://127.0.0.1:80/api/health | grep -q '"status"' \
  || curl -fsS http://127.0.0.1:80/healthz | grep -q HEALTHY \
  || fail "nginx :80 /api/health failed"
curl -fsS http://127.0.0.1:80/ | grep -qi 'nexus\|shield\|html' \
  || log "WARN: root / may be Vercel HTML (check manually in browser)"

log "5/5 Public checks (via Cloudflare)"
_pub_api=$(curl -sS -o /tmp/unified-api-health.out -w '%{http_code}' --max-time 25 \
  https://api.nexusshield.ai/api/health || echo "000")
_pub_root=$(curl -sS -o /tmp/unified-root.out -w '%{http_code}' --max-time 25 \
  https://api.nexusshield.ai/ || echo "000")

log "Public /api/health HTTP ${_pub_api}"
log "Public / HTTP ${_pub_root}"

if [[ "$_pub_api" == "200" ]]; then
  head -c 200 /tmp/unified-api-health.out || true
  echo
  log "OK — Unified domain ready: UI at /, API at /api/*"
else
  log "WARN — Public /api/health returned ${_pub_api}. Check tunnel origin = :80"
fi
