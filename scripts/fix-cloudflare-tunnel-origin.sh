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

log "1/6 Docker stack yenileniyor (nginx-gateway :80 + nexus-shield-api :8080)..."
docker compose --env-file .env -f docker-compose.prod.yml up -d --build --remove-orphans

log "2/6 nginx-gateway yeniden baslatiliyor..."
docker compose --env-file .env -f docker-compose.prod.yml restart nginx-gateway

log "3/6 Eski cloudflared konteyneri kaldiriliyor (isim cakismasi onlemi)..."
docker rm -f cloudflared-prod 2>/dev/null || true

log "4/6 cloudflared (host network -> localhost:80) baslatiliyor..."
docker compose --env-file .env --profile cloudflare -f docker-compose.prod.yml up -d cloudflared

log "5/6 Yerel dogrulama..."
curl -fsS http://127.0.0.1:80/ | grep -q "Nexus Shield" || {
  log "HATA: :80 landing page HTML donmuyor"
  curl -sS http://127.0.0.1:80/ | head -c 200
  exit 1
}
curl -fsS http://127.0.0.1:8080/healthz | grep -q HEALTHY || {
  log "HATA: Fast API healthz basarisiz"
  exit 1
}

log "6/6 Cloudflared network modu:"
docker inspect cloudflared-prod --format 'NetworkMode={{.HostConfig.NetworkMode}}'

cat <<'EOF'

OK — Origin http://127.0.0.1:80 (Nginx Gateway) uzerinden landing page hazir.

Cloudflare Zero Trust panelinde Public Hostname service URL:
  http://127.0.0.1:80   (veya http://localhost:80)
  YANLIS: http://localhost:8000

Canli test:
  curl -s https://api.nexusshield.ai/ | grep "<title>"

EOF
