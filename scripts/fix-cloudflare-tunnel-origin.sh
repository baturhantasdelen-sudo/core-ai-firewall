#!/usr/bin/env bash
# fix-cloudflare-tunnel-origin.sh — Cloudflare Tunnel origin'i Nginx :80'e sabitle
#
# Kullanim (production sunucusunda):
#   cd /opt/nexus-core-firewall
#   sudo bash scripts/fix-cloudflare-tunnel-origin.sh
#
# Cloudflare Zero Trust panelinde de kontrol edin:
#   Networks > Tunnels > Public Hostname > Service URL = http://127.0.0.1:80
#   (http://localhost:8000 veya :8080 OLMAZ)

set -euo pipefail

DEPLOY_PATH="${DEPLOY_PATH:-/opt/nexus-core-firewall}"
cd "$DEPLOY_PATH"

log() { echo "[fix-tunnel] $*"; }

COMPOSE=(docker compose --env-file .env -f docker-compose.prod.yml)
COMPOSE_CLOUDFLARE=(docker compose --env-file .env --profile cloudflare -f docker-compose.prod.yml)

log "1/4 Eski cloudflared konteyneri kaldiriliyor (isim cakismasi onlemi)..."
docker rm -f cloudflared-prod 2>/dev/null || true

log "2/4 Docker stack yenileniyor (--profile cloudflare)..."
"${COMPOSE_CLOUDFLARE[@]}" up -d --remove-orphans
"${COMPOSE[@]}" up -d nginx-gateway

log "3/4 Post-deploy healthcheck..."
bash scripts/post-deploy-healthcheck.sh

log "4/4 Cloudflared network modu:"
if docker ps --format '{{.Names}}' | grep -q '^cloudflared-prod$'; then
  docker inspect cloudflared-prod --format 'NetworkMode={{.HostConfig.NetworkMode}}'
else
  log "cloudflared-prod calismiyor (token eksik veya profil devre disi)"
fi

cat <<'EOF'

OK — Origin http://127.0.0.1:80 (Nginx Gateway) uzerinden landing page hazir.

Cloudflare Zero Trust panelinde Public Hostname service URL:
  http://127.0.0.1:80   (veya http://localhost:80)
  YANLIS: http://localhost:8000

Canli test:
  curl -s https://api.nexusshield.ai/ | grep "<title>"

EOF
