#!/usr/bin/env bash
# Emergency prod VM disk recovery (GCP /opt/nexus-core-firewall).
# Run on server: sudo bash scripts/prod-emergency-disk-cleanup.sh
# Or trigger: GitHub Actions → Production VM Maintenance → cleanup
set -euo pipefail

DEPLOY_PATH="${DEPLOY_PATH:-/opt/nexus-core-firewall}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
DOCKER="${DOCKER:-sudo docker}"
MIN_FREE_KIB="${MIN_FREE_KIB:-$((1024 * 1024))}" # 1 GiB target after cleanup

log() { echo "[disk-cleanup] $*"; }

avail_kib() { df -Pk / | awk 'NR==2 {print $4}'; }

log "=== BEFORE ==="
df -h / /var/lib/docker 2>/dev/null || df -h /
du -sh /var/lib/docker 2>/dev/null || true
du -sh "${DEPLOY_PATH}" 2>/dev/null || true

if [[ -d "${DEPLOY_PATH}" ]]; then
  cd "${DEPLOY_PATH}"
  if [[ -f "${COMPOSE_FILE}" ]]; then
    log "Stopping prod stack (down --remove-orphans)"
    _dc=($DOCKER compose -f "${COMPOSE_FILE}")
    [[ -f .env ]] && _dc+=(--env-file .env)
    "${_dc[@]}" --profile cloudflare --profile ml down --remove-orphans \
      || "${_dc[@]}" down --remove-orphans || true
  fi
fi

$DOCKER rm -f cloudflared-prod 2>/dev/null || true
$DOCKER network prune -f || true
$DOCKER container prune -f || true
$DOCKER builder prune -af || true
$DOCKER image prune -af || true
$DOCKER system prune -af || true
# Unused volumes only (named prod data under ./data is bind-mount, not a named vol)
$DOCKER volume prune -f || true

if command -v journalctl >/dev/null 2>&1; then
  sudo journalctl --vacuum-size=128M 2>/dev/null || true
fi
if command -v apt-get >/dev/null 2>&1; then
  sudo apt-get clean -y 2>/dev/null || true
  sudo apt-get autoremove -y 2>/dev/null || true
fi

# Large nginx / app logs on host
if [[ -d /var/log/nginx ]]; then
  sudo find /var/log/nginx -type f -name '*.log' -size +50M -exec truncate -s 0 {} \; 2>/dev/null || true
fi
find "${DEPLOY_PATH}" -maxdepth 3 -type f -name '*.log' -size +20M -delete 2>/dev/null || true

log "=== Largest dirs under / (top 15) ==="
sudo du -xh / 2>/dev/null | sort -h | tail -15 || du -xh /var/lib/docker 2>/dev/null | sort -h | tail -10 || true

AVAIL="$(avail_kib)"
log "=== AFTER cleanup: ${AVAIL} KiB free on / ==="
df -h /

if [[ "${AVAIL}" -lt "${MIN_FREE_KIB}" ]]; then
  log "ERROR: Still below $(( MIN_FREE_KIB / 1024 )) MiB free."
  log "GCP: Console → Compute Engine → VM → Edit → Boot disk → increase (e.g. 20→40 GB),"
  log "     then run: bash scripts/gcp-grow-root-filesystem.sh"
  exit 1
fi

log "OK — enough space for deploy/SCP. Restart stack with recover-docker-stack.sh or re-run CI deploy."
