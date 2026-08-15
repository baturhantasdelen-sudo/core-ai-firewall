#!/usr/bin/env bash
# start-tunnel.sh — Recover Nexus Shield production stack + Cloudflare Tunnel
#
# Usage (production server):
#   cd /opt/nexus-core-firewall
#   sudo bash scripts/start-tunnel.sh
#
# Ensures:
#   - nginx-gateway on :80 (origin for cloudflared)
#   - nexus-shield-api on :8080
#   - cloudflared-prod with network_mode=host -> http://127.0.0.1:80
#
# Cloudflare Zero Trust Public Hostname MUST point to:
#   http://127.0.0.1:80  (NOT :8000 or :8080)

set -euo pipefail

DEPLOY_PATH="${DEPLOY_PATH:-/opt/nexus-core-firewall}"
PUBLIC_URL="${PUBLIC_URL:-https://api.nexusshield.ai}"
MAX_RETRIES="${MAX_RETRIES:-3}"
RETRY_DELAY="${RETRY_DELAY:-5}"

cd "$DEPLOY_PATH"

log() { echo "[start-tunnel] $(date -Is) $*"; }
fail() { log "ERROR: $*"; exit 1; }

if [[ ! -f docker-compose.prod.yml ]]; then
  fail "docker-compose.prod.yml not found in ${DEPLOY_PATH}"
fi

if [[ ! -f .env ]]; then
  fail ".env missing — run deploy or create .env with DOCKER_IMAGE, NEXUS_API_KEY, CLOUDFLARE_TUNNEL_TOKEN"
fi

if ! grep -q '^CLOUDFLARE_TUNNEL_TOKEN=.\+' .env 2>/dev/null; then
  log "WARN: CLOUDFLARE_TUNNEL_TOKEN empty — cloudflared will not start"
fi

COMPOSE=(docker compose --env-file .env -f docker-compose.prod.yml)
COMPOSE_CF=(docker compose --env-file .env --profile cloudflare -f docker-compose.prod.yml)

log "1/6 Stop non-essential services to free RAM for ML Guard cold start"
docker stop cloudflared-prod nginx-gateway-prod nexus-shield-api-prod 2>/dev/null || true
docker rm -f cloudflared-prod cloudflared cloudflared-quick 2>/dev/null || true

log "2/6 Start ML Guard API first (memory-heavy cold start)"
"${COMPOSE[@]}" up -d nexus-api

log "2b/6 Wait for nexus-api-prod health (low-RAM cold start may take 10-15 min)"
_api_ok=false
for attempt in $(seq 1 30); do
  _health=$(docker inspect nexus-api-prod --format '{{.State.Health.Status}}' 2>/dev/null || echo "unknown")
  if [[ "$_health" == "healthy" ]]; then
    _api_ok=true
    log "nexus-api-prod is healthy"
    break
  fi
  if docker exec nexus-api-prod curl -fsS -m 10 http://127.0.0.1:8000/healthz 2>/dev/null | grep -q HEALTHY; then
    _api_ok=true
    log "nexus-api-prod /healthz responded HEALTHY"
    break
  fi
  log "nexus-api-prod status=${_health} (attempt ${attempt}/30, waiting 30s)..."
  sleep 30
done
[[ "$_api_ok" == true ]] || log "WARN: nexus-api-prod not yet healthy — continuing stack bring-up"

log "2c/6 Start Fast API + nginx gateway"
"${COMPOSE[@]}" up -d --remove-orphans nexus-shield-api nginx-gateway

log "3/6 Wait for local origin health (:80 /healthz)"
_origin_ok=false
for attempt in $(seq 1 "$MAX_RETRIES"); do
  if curl -fsS http://127.0.0.1:80/healthz | grep -q HEALTHY; then
    _origin_ok=true
    break
  fi
  log "Origin not ready (attempt ${attempt}/${MAX_RETRIES}), retrying in ${RETRY_DELAY}s..."
  sleep "$RETRY_DELAY"
done
[[ "$_origin_ok" == true ]] || fail "nginx-gateway :80 /healthz not HEALTHY"

log "4/6 Start cloudflared tunnel (--profile cloudflare)"
"${COMPOSE_CF[@]}" up -d cloudflared

log "5/6 Verify cloudflared container"
sleep 6
if ! docker ps --format '{{.Names}}' | grep -q '^cloudflared-prod$'; then
  docker logs --tail 40 cloudflared-prod 2>&1 || true
  fail "cloudflared-prod is not running — check CLOUDFLARE_TUNNEL_TOKEN and docker logs"
fi

_cf_status=$(docker inspect cloudflared-prod --format '{{.State.Status}}')
log "cloudflared-prod status=${_cf_status} NetworkMode=$(docker inspect cloudflared-prod --format '{{.HostConfig.NetworkMode}}')"
docker logs --tail 15 cloudflared-prod 2>&1 || true

log "6/6 Public URL health check: ${PUBLIC_URL}/healthz"
_live_ok=false
for attempt in $(seq 1 "$MAX_RETRIES"); do
  _code=$(curl -sS -o /tmp/nexus-health.out -w '%{http_code}' --max-time 20 "${PUBLIC_URL}/healthz" || echo "000")
  if [[ "$_code" == "200" ]] && grep -q HEALTHY /tmp/nexus-health.out 2>/dev/null; then
    _live_ok=true
    break
  fi
  log "Public health returned HTTP ${_code} (attempt ${attempt}/${MAX_RETRIES})"
  sleep "$RETRY_DELAY"
done

if [[ "$_live_ok" == true ]]; then
  log "OK — Tunnel HEALTHY. ${PUBLIC_URL} is reachable."
  cat /tmp/nexus-health.out
  exit 0
fi

log "WARN — Local origin is healthy but public URL still failing."
log "Check Cloudflare Zero Trust: Public Hostname -> Service URL = http://127.0.0.1:80"
curl -sS --max-time 15 "${PUBLIC_URL}/healthz" 2>&1 | head -c 300 || true
echo
exit 1
