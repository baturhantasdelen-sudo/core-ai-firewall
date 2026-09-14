#!/usr/bin/env bash
# Recover Nexus stack after "no space left on device" or failed parallel builds.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

DOCKER="${DOCKER:-sudo docker}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
DEPLOY_ML_IMAGE="${DEPLOY_ML_IMAGE:-0}"

echo "==> Disk usage before cleanup"
df -h / /var/lib/docker 2>/dev/null || df -h /

echo "==> Stop stack"
$DOCKER compose -f "${COMPOSE_FILE}" down --remove-orphans 2>/dev/null || true

echo "==> Docker cleanup (images, build cache, stopped containers)"
$DOCKER container prune -f || true
$DOCKER builder prune -af || true
$DOCKER image prune -af || true

echo "==> Disk usage after cleanup"
df -h / /var/lib/docker 2>/dev/null || df -h /

AVAIL_KB="$(df -Pk / | awk 'NR==2 {print $4}')"
MIN_FAST_KB=$((1500 * 1024))
if [[ "${AVAIL_KB}" -lt "${MIN_FAST_KB}" ]]; then
  echo "ERROR: Less than 1.5 GiB free on /. Expand disk or remove old files before rebuild."
  echo "       Available KiB: ${AVAIL_KB}"
  exit 1
fi

echo "==> Build lightweight Fast API (Dockerfile.fast)"
export DOCKER_FAST_IMAGE="${DOCKER_FAST_IMAGE:-nexus-shield-fast:local}"
$DOCKER compose -f "${COMPOSE_FILE}" build nexus-shield-api

echo "==> Start Fast API + nginx gateway"
$DOCKER compose -f "${COMPOSE_FILE}" up -d nexus-shield-api nginx-gateway

if [[ "${DEPLOY_ML_IMAGE}" == "1" ]]; then
  MIN_ML_KB=$((5120 * 1024))
  if [[ "${AVAIL_KB}" -ge "${MIN_ML_KB}" ]]; then
    echo "==> DEPLOY_ML_IMAGE=1 — pull/start PyTorch ML API"
    $DOCKER compose -f "${COMPOSE_FILE}" pull nexus-api || true
    $DOCKER compose -f "${COMPOSE_FILE}" --profile ml up -d nexus-api
  else
    echo "WARN: Skipping ML API — need 5 GiB free for PyTorch image"
  fi
else
  echo "==> Lightweight recovery: ML API skipped (set DEPLOY_ML_IMAGE=1 to enable)"
fi

echo "==> Wait for health"
sleep 15
$DOCKER compose -f "${COMPOSE_FILE}" ps

echo "==> Runtime checks"
curl -fsS http://127.0.0.1:8080/healthz | grep -q HEALTHY && echo "Fast API: OK" || echo "Fast API: FAIL"
curl -fsS http://127.0.0.1:80/healthz | grep -q HEALTHY && echo "Nginx gateway: OK" || echo "Nginx gateway: FAIL"
