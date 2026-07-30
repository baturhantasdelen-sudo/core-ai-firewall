#!/usr/bin/env bash
# Rebuild and start Nexus Shield Fast stack with live .py reload (no stale cache).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "==> Building Fast API image (no cache)..."
docker compose -f docker-compose.fast.yml build --no-cache nexus-shield-api

echo "==> Starting redis + nexus-shield-api on :8080..."
docker compose -f docker-compose.fast.yml up -d --force-recreate

echo "==> Waiting for healthcheck..."
for i in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:8080/healthz >/dev/null 2>&1; then
    echo "OK — Fast API healthy at http://localhost:8080"
    echo "Dashboard: http://localhost:8080/dashboard"
    exit 0
  fi
  sleep 1
done

echo "WARN — healthcheck timed out; check: docker compose -f docker-compose.fast.yml logs nexus-shield-api"
exit 1
