#!/usr/bin/env bash
# Weekly traffic summary for Nexus Shield landing + API usage.
# Reads persistent nginx access logs from /var/log/nginx (host volume).
set -euo pipefail

NGINX_LOG_DIR="${NGINX_LOG_DIR:-/var/log/nginx}"
ACCESS_LOG="${NGINX_LOG_DIR}/access.log"
REPORT_TS="$(date -u '+%Y-%m-%d %H:%M:%S UTC')"

collect_logs() {
  if [[ -f "$ACCESS_LOG" ]]; then
    cat "$ACCESS_LOG" "${ACCESS_LOG}".* 2>/dev/null || cat "$ACCESS_LOG"
    return
  fi
  echo "WARN: ${ACCESS_LOG} not found — falling back to docker logs" >&2
  sudo docker logs nginx-gateway-prod 2>&1
}

LOG="$(collect_logs)"

echo "=== NEXUS SHIELD TRAFFIC REPORT ==="
echo "generated_at: ${REPORT_TS}"
echo "log_source: ${ACCESS_LOG}"
echo

echo "=== REQUEST COUNTS ==="
landing=$(echo "$LOG" | grep -c '"GET / HTTP' || true)
trial=$(echo "$LOG" | grep -c 'register-trial' || true)
shield=$(echo "$LOG" | grep -c '/v1/shield' || true)
sandbox=$(echo "$LOG" | grep -c '/api/sandbox' || true)
healthz=$(echo "$LOG" | grep -c '/healthz' || true)
dashboard=$(echo "$LOG" | grep -c '/dashboard' || true)
analytics_cfg=$(echo "$LOG" | grep -c 'analytics-config.js' || true)
bots=$(echo "$LOG" | grep -cE '\.php|/wp-|/\.env' || true)

echo "landing_page_GET_root: $landing"
echo "register_trial: $trial"
echo "v1_shield: $shield"
echo "api_sandbox: $sandbox"
echo "healthz: $healthz"
echo "dashboard: $dashboard"
echo "analytics_config_js: $analytics_cfg"
echo "scanner_bot_hits: $bots"

echo
echo "=== LEGIT LANDING VISITS (GET / 200, exclude curl health probes) ==="
echo "$LOG" | grep '"GET / HTTP' | grep ' 200 ' | grep -v 'curl/' | tail -15

echo
echo "=== TRIAL REGISTRATIONS (nginx) ==="
echo "$LOG" | grep 'register-trial' | tail -10

echo
echo "=== SHIELD API USAGE (nginx) ==="
echo "$LOG" | grep -E '/v1/shield|/api/sandbox' | tail -15

echo
echo "=== UNIQUE CLIENT IPS (GET / 200) ==="
echo "$LOG" | grep '"GET / HTTP' | grep ' 200 ' | awk '{print $1}' | sort -u | wc -l
