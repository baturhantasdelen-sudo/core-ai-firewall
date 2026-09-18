#!/usr/bin/env bash
# Install daily Supabase keep-alive cron (03:00 server local time).
#
# Usage:
#   sudo bash scripts/install-supabase-keepalive-cron.sh
#
# Optional: create /opt/nexus-core-firewall/.env.supabase with:
#   SUPABASE_ANON_KEY=eyJ...

set -euo pipefail

DEPLOY_PATH="${DEPLOY_PATH:-/opt/nexus-core-firewall}"
KEEPALIVE_SCRIPT="${DEPLOY_PATH}/scripts/supabase-keepalive.sh"
LOG_FILE="/var/log/supabase_keepalive.log"
CRON_SCHEDULE="${CRON_SCHEDULE:-0 3 * * *}"

log() { echo "[install-supabase-keepalive] $*"; }

if [[ ! -f "$KEEPALIVE_SCRIPT" ]]; then
  echo "ERROR: ${KEEPALIVE_SCRIPT} not found" >&2
  exit 1
fi

chmod +x "$KEEPALIVE_SCRIPT"
touch "$LOG_FILE"
chmod 644 "$LOG_FILE"

CRON_LINE="${CRON_SCHEDULE} ${KEEPALIVE_SCRIPT}"

log "Installing cron: ${CRON_LINE}"
( crontab -l 2>/dev/null | grep -Fv "supabase-keepalive.sh" || true
  echo "$CRON_LINE"
) | crontab -

log "Current crontab:"
crontab -l | grep supabase-keepalive || true

log "Running one test ping..."
if bash "$KEEPALIVE_SCRIPT"; then
  log "Test OK — see tail of ${LOG_FILE}"
  tail -3 "$LOG_FILE" || true
else
  log "WARN test ping failed — set SUPABASE_ANON_KEY in ${DEPLOY_PATH}/.env.supabase"
  tail -5 "$LOG_FILE" || true
  exit 1
fi

log "Done."
