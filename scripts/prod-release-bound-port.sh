#!/usr/bin/env bash
# Stop containers and compose stacks that hold a host port (e.g. 8080 already allocated).
#
# Usage (production server):
#   cd /opt/nexus-core-firewall
#   sudo bash scripts/prod-release-bound-port.sh 8080

set -euo pipefail

PORT="${1:-8080}"
ROOT="${DEPLOY_PATH:-/opt/nexus-core-firewall}"
DOCKER="${DOCKER:-sudo docker}"

cd "${ROOT}"

log() { echo "[release-port:${PORT}] $*"; }

containers_on_port() {
  "${DOCKER}" ps -a --format '{{.ID}} {{.Ports}}' 2>/dev/null \
    | awk -v p=":${PORT}->" '$0 ~ p {print $1}'
}

log "Compose down (prod + dev stacks if present)"
_dc_prod=("${DOCKER}" compose -f docker-compose.prod.yml)
[[ -f .env ]] && _dc_prod+=(--env-file .env)
"${_dc_prod[@]}" --profile cloudflare --profile ml down --remove-orphans 2>/dev/null \
  || "${_dc_prod[@]}" down --remove-orphans 2>/dev/null || true

if [[ -f docker-compose.yml ]]; then
  "${DOCKER}" compose -f docker-compose.yml down --remove-orphans 2>/dev/null || true
fi

log "Remove known Nexus containers (stale names from prod/dev)"
for name in nexus-shield-api-prod nexus_shield_app nexus-api-prod nginx-gateway-prod \
  nginx_gateway_container nexus_api_container cloudflared-prod; do
  "${DOCKER}" rm -f "${name}" 2>/dev/null || true
done

log "Remove any container publishing host :${PORT}"
while IFS= read -r cid; do
  [[ -z "${cid}" ]] && continue
  cname="$("${DOCKER}" inspect -f '{{.Name}}' "${cid}" 2>/dev/null | sed 's|^/||' || echo "${cid}")"
  log "  rm -f ${cname} (${cid})"
  "${DOCKER}" rm -f "${cid}" 2>/dev/null || true
done < <(containers_on_port || true)

if command -v ss >/dev/null 2>&1; then
  if ss -tulpn 2>/dev/null | grep -qE ":${PORT}\s"; then
    log "WARN: port ${PORT} still appears in ss — listing listeners:"
    ss -tulpn 2>/dev/null | grep -E ":${PORT}\s" || true
    "${DOCKER}" ps -a --format 'table {{.Names}}\t{{.Ports}}\t{{.Status}}' | grep -E "${PORT}|NAMES" || true
    exit 1
  fi
fi

log "Port ${PORT} is free"
