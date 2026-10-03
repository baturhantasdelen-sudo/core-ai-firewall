#!/usr/bin/env bash
# Full prod stack recycle when compose references a dead container or service name drift.
#
# Usage (production VM):
#   cd /opt/nexus-core-firewall
#   sudo bash scripts/prod-stack-restart.sh
#
# Service name in compose: nexus-shield-api
# Container name on host:  nexus-shield-api-prod

set -euo pipefail

ROOT="${DEPLOY_PATH:-/opt/nexus-core-firewall}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
DOCKER="${DOCKER:-sudo docker}"

cd "${ROOT}"

echo "==> Current containers (look for nexus-shield-api-prod / nginx-gateway-prod)"
${DOCKER} ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' \
  | grep -E 'NAMES|nexus|nginx|cloudflared' || ${DOCKER} ps -a

echo "==> Release :8080 and remove stale Nexus container names"
bash "$(dirname "$0")/prod-release-bound-port.sh" 8080

_dc=("${DOCKER}" compose -f "${COMPOSE_FILE}")
[[ -f .env ]] && _dc+=(--env-file .env)

echo "==> Compose down (remove orphans)"
"${_dc[@]}" --profile cloudflare --profile ml down --remove-orphans \
  || "${_dc[@]}" down --remove-orphans || true

echo "==> Rebuild and start nexus-shield-api + nginx-gateway"
"${_dc[@]}" build nexus-shield-api
"${_dc[@]}" up -d --remove-orphans --force-recreate --wait nexus-shield-api nginx-gateway

echo "==> Post-up status"
"${_dc[@]}" ps

bash "$(dirname "$0")/wait-for-http.sh" "http://127.0.0.1:8080/healthz" HEALTHY 30 2
bash "$(dirname "$0")/wait-for-http.sh" "http://127.0.0.1:80/healthz" HEALTHY 45 2
echo "PROD_STACK_OK"
