#!/usr/bin/env bash
# Install weekly traffic_report.sh cron + ensure nginx log directory exists.
# Run on production host after deploy:
#   sudo bash /opt/nexus-core-firewall/scripts/install-traffic-report-cron.sh
set -euo pipefail

DEPLOY_PATH="${DEPLOY_PATH:-/opt/nexus-core-firewall}"
REPORT_SCRIPT="${DEPLOY_PATH}/scripts/traffic_report.sh"
REPORT_LOG="/var/log/nexus-traffic-report.log"
CRON_SCHEDULE="${CRON_SCHEDULE:-0 9 * * 1}"  # Mondays 09:00 UTC
NGINX_UID="${NGINX_UID:-101}"  # nginx user in nginx:alpine

log() { echo "[install-traffic-report] $*"; }

if [[ ! -f "$REPORT_SCRIPT" ]]; then
  echo "ERROR: ${REPORT_SCRIPT} not found" >&2
  exit 1
fi

chmod +x "$REPORT_SCRIPT"

log "Ensuring /var/log/nginx exists (persistent access logs)..."
mkdir -p /var/log/nginx
chown "${NGINX_UID}:${NGINX_UID}" /var/log/nginx
chmod 755 /var/log/nginx

log "Installing logrotate for nginx access logs..."
cat > /etc/logrotate.d/nexus-nginx <<'ROTATE'
/var/log/nginx/*.log {
    daily
    rotate 14
    missingok
    notifempty
    compress
    delaycompress
    sharedscripts
    postrotate
        docker kill -s USR1 nginx-gateway-prod 2>/dev/null || true
    endscript
}
ROTATE

CRON_LINE="${CRON_SCHEDULE} ${REPORT_SCRIPT} >> ${REPORT_LOG} 2>&1"
TMP_CRON="$(mktemp)"
(crontab -l 2>/dev/null | grep -v 'traffic_report.sh' || true) > "$TMP_CRON"
echo "$CRON_LINE" >> "$TMP_CRON"
crontab "$TMP_CRON"
rm -f "$TMP_CRON"

log "Cron installed: ${CRON_LINE}"
log "Reports append to ${REPORT_LOG}"
crontab -l | grep traffic_report.sh || true

log "Done."
