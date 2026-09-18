#!/usr/bin/env bash
# supabase-keepalive.sh — Prevent Supabase free-tier project from pausing (daily REST ping)
#
# Ping target: public REST table (anon key). Override if needed, e.g. waitlist:
#   SUPABASE_REST_URL=https://.../rest/v1/waitlist?select=count&limit=1
#
#   SUPABASE_ANON_KEY='eyJ...' bash scripts/supabase-keepalive.sh
#
# Install cron (daily 03:00):
#   sudo bash scripts/install-supabase-keepalive-cron.sh
#
# Anon key sources (first match wins):
#   1. SUPABASE_ANON_KEY env
#   2. NEXT_PUBLIC_SUPABASE_ANON_KEY env
#   3. /opt/nexus-core-firewall/.env.supabase (SUPABASE_ANON_KEY=...)
#   4. nexus-shield-dashboard/.env.local on deploy host
#
# Get the key: Supabase Dashboard → Project Settings → API → anon public key

set -euo pipefail

SUPABASE_REST_URL="${SUPABASE_REST_URL:-https://lculcijmldsrxkbjvxhh.supabase.co/rest/v1/users?select=count&limit=1}"
LOG_FILE="${LOG_FILE:-/var/log/supabase_keepalive.log}"
TIMEOUT_SEC="${TIMEOUT_SEC:-10}"
DEPLOY_PATH="${DEPLOY_PATH:-/opt/nexus-core-firewall}"

log() {
  echo "$(date -Is) $*"
}

load_anon_key() {
  if [[ -n "${SUPABASE_ANON_KEY:-}" ]]; then
    return 0
  fi
  if [[ -n "${NEXT_PUBLIC_SUPABASE_ANON_KEY:-}" ]]; then
    SUPABASE_ANON_KEY="$NEXT_PUBLIC_SUPABASE_ANON_KEY"
    return 0
  fi

  local env_file
  for env_file in \
    "${DEPLOY_PATH}/.env.supabase" \
    "${DEPLOY_PATH}/nexus-shield-dashboard/.env.local" \
    "${DEPLOY_PATH}/.env"; do
    if [[ -f "$env_file" ]]; then
      local line
      line=$(grep -E '^(SUPABASE_ANON_KEY|NEXT_PUBLIC_SUPABASE_ANON_KEY)=' "$env_file" 2>/dev/null | head -1 || true)
      if [[ -n "$line" ]]; then
        SUPABASE_ANON_KEY="${line#*=}"
        SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY%\"}"
        SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY#\"}"
        SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY%\'}"
        SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY#\'}"
        export SUPABASE_ANON_KEY
        return 0
      fi
    fi
  done
  return 1
}

run_ping() {
  local http_code
  local body

  http_code=$(curl -sS -o /tmp/supabase_keepalive_body.txt -w '%{http_code}' \
    --max-time "$TIMEOUT_SEC" \
    -H "apikey: ${SUPABASE_ANON_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
    -H "Accept: application/json" \
    "${SUPABASE_REST_URL}") || {
    log "ERROR curl failed (exit $?)"
    return 1
  }

  body=$(head -c 200 /tmp/supabase_keepalive_body.txt 2>/dev/null | tr -d '\n' || true)
  log "OK HTTP ${http_code} url=${SUPABASE_REST_URL} body_preview=${body}"

  if [[ "$http_code" =~ ^2 ]]; then
    return 0
  fi
  log "WARN unexpected HTTP ${http_code}"
  return 1
}

main() {
  mkdir -p "$(dirname "$LOG_FILE")"
  touch "$LOG_FILE" 2>/dev/null || LOG_FILE="${DEPLOY_PATH}/logs/supabase_keepalive.log"

  {
    if ! load_anon_key; then
      log "ERROR SUPABASE_ANON_KEY not set. Add to ${DEPLOY_PATH}/.env.supabase:"
      log "  SUPABASE_ANON_KEY=<anon key from Supabase Dashboard → Settings → API>"
      exit 1
    fi
    run_ping
  } >> "$LOG_FILE" 2>&1
}

main "$@"
