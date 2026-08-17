#!/usr/bin/env bash
# setup-cloudflare-service.sh — Cloudflare Named Tunnel + systemd + keepalive watchdog
#
# Usage (production Ubuntu/Debian):
#   cd /opt/nexus-core-firewall
#   sudo CLOUDFLARE_TUNNEL_TOKEN='eyJ…' bash scripts/setup-cloudflare-service.sh
#
# Options:
#   TUNNEL_MODE=docker|systemd   default docker (matches docker-compose.prod.yml)
#   TUNNEL_ID=…                  required for systemd named tunnel
#   DEPLOY_PATH=/opt/nexus-core-firewall

set -euo pipefail

DEPLOY_PATH="${DEPLOY_PATH:-/opt/nexus-core-firewall}"
TUNNEL_MODE="${TUNNEL_MODE:-docker}"
PUBLIC_URL="${PUBLIC_URL:-https://api.nexusshield.ai}"
ORIGIN_URL="${ORIGIN_URL:-http://127.0.0.1:80}"

log() { echo "[setup-cloudflare] $(date -Is) $*"; }
fail() { log "ERROR: $*"; exit 1; }

[[ "$(id -u)" -eq 0 ]] || fail "Run as root: sudo bash scripts/setup-cloudflare-service.sh"

cd "$DEPLOY_PATH"
[[ -f docker-compose.prod.yml ]] || fail "docker-compose.prod.yml not found in ${DEPLOY_PATH}"

log "1/7 Install cloudflared CLI (if missing)"
if ! command -v cloudflared >/dev/null 2>&1; then
  curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
  echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared jammy main' \
    | tee /etc/apt/sources.list.d/cloudflared.list
  apt-get update -qq
  apt-get install -y cloudflared
fi
cloudflared --version

log "2/7 Validate tunnel config template"
CONFIG_SRC="${DEPLOY_PATH}/deploy/cloudflared/config.yml"
[[ -f "$CONFIG_SRC" ]] || fail "Missing ${CONFIG_SRC}"

mkdir -p /etc/cloudflared
if [[ -n "${TUNNEL_ID:-}" ]]; then
  sed "s/\${TUNNEL_ID}/${TUNNEL_ID}/g" "$CONFIG_SRC" > /etc/cloudflared/config.yml
  log "Wrote /etc/cloudflared/config.yml (TUNNEL_ID=${TUNNEL_ID})"
else
  cp "$CONFIG_SRC" /etc/cloudflared/config.yml
  log "Copied config template — set TUNNEL_ID + credentials.json for systemd named tunnel"
fi

cat <<'EOF'

Expected ingress (verify in /etc/cloudflared/config.yml or Cloudflare Zero Trust panel):
  - hostname: api.nexusshield.ai  ->  service: http://127.0.0.1:80
  - hostname: nexusshield.ai      ->  service: http://127.0.0.1:80
  - no-autoupdate: false          (allow cloudflared auto-updates)
  - retries: 5                    (reconnect after transient drops)

EOF

log "3/7 Ensure .env has CLOUDFLARE_TUNNEL_TOKEN (docker mode)"
if [[ -f .env ]] && grep -q '^CLOUDFLARE_TUNNEL_TOKEN=.\+' .env; then
  log "CLOUDFLARE_TUNNEL_TOKEN present in .env"
elif [[ -n "${CLOUDFLARE_TUNNEL_TOKEN:-}" ]]; then
  if grep -q '^CLOUDFLARE_TUNNEL_TOKEN=' .env 2>/dev/null; then
    sed -i "s|^CLOUDFLARE_TUNNEL_TOKEN=.*|CLOUDFLARE_TUNNEL_TOKEN=${CLOUDFLARE_TUNNEL_TOKEN}|" .env
  else
    echo "CLOUDFLARE_TUNNEL_TOKEN=${CLOUDFLARE_TUNNEL_TOKEN}" >> .env
  fi
  log "CLOUDFLARE_TUNNEL_TOKEN written to .env"
else
  log "WARN: Set CLOUDFLARE_TUNNEL_TOKEN in .env or export before running"
fi

log "4/7 Install systemd units"
install -m 644 "${DEPLOY_PATH}/deploy/cloudflared/nexus-tunnel.service" /etc/systemd/system/nexus-tunnel.service
install -m 644 "${DEPLOY_PATH}/deploy/cloudflared/tunnel-keepalive.service" /etc/systemd/system/tunnel-keepalive.service
systemctl daemon-reload

if [[ "$TUNNEL_MODE" == "systemd" ]]; then
  log "5/7 Install cloudflared as OS service (named tunnel)"
  [[ -f /etc/cloudflared/credentials.json ]] || fail "Missing /etc/cloudflared/credentials.json for named tunnel"
  cloudflared --config /etc/cloudflared/config.yml service install
  systemctl enable cloudflared
  systemctl restart cloudflared
else
  log "5/7 Docker tunnel mode — cloudflared runs as cloudflared-prod container"
  docker rm -f cloudflared-prod cloudflared cloudflared-quick 2>/dev/null || true
  docker compose --env-file .env --profile cloudflare -f docker-compose.prod.yml up -d cloudflared
fi

log "6/7 Enable boot recovery + keepalive watchdog"
systemctl enable nexus-tunnel.service
systemctl enable tunnel-keepalive.service
systemctl restart tunnel-keepalive.service || true

log "7/7 Health verification"
bash scripts/post-deploy-healthcheck.sh || true

_code=$(curl -sS -o /tmp/nexus-pub-health.out -w '%{http_code}' --max-time 25 "${PUBLIC_URL}/healthz" || echo "000")
if [[ "$_code" == "200" ]]; then
  log "OK — ${PUBLIC_URL}/healthz returned 200"
  head -c 200 /tmp/nexus-pub-health.out || true
  echo
else
  log "WARN — Public health HTTP ${_code}. If Error 1033 persists:"
  cat <<EOF
  1. Cloudflare Zero Trust → Networks → Tunnels → Public Hostname
     Service URL MUST be ${ORIGIN_URL} (NOT :8000 or :8080)
  2. systemctl status tunnel-keepalive cloudflared nexus-tunnel
  3. docker logs --tail 50 cloudflared-prod
  4. node scripts/tunnel-keepalive.js  (foreground debug)
EOF
fi

log "Setup complete."
