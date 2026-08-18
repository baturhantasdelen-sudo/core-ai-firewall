#!/usr/bin/env bash
# deploy-p2-policy-engine.sh — Full P2 Policy Engine + DLP deployment on production
#
# Usage:
#   cd /opt/nexus-core-firewall
#   sudo bash scripts/deploy-p2-policy-engine.sh

set -euo pipefail

DEPLOY_PATH="${DEPLOY_PATH:-/opt/nexus-core-firewall}"
cd "$DEPLOY_PATH"

log() { echo "[deploy-p2] $*"; }
fail() { log "ERROR: $*"; exit 1; }

[[ -f docker-compose.prod.yml ]] || fail "Run from $DEPLOY_PATH"
[[ -f .env ]] || fail ".env missing"

log "1/5 Ensure config/policies.json"
mkdir -p config
cat > config/policies.json << 'EOF'
{
  "policies": {
    "agent-finance-01": {
      "allowed_tools": ["read_invoice", "get_account_balance"],
      "blocked_tools": [
        "execute_unauthorized_command",
        "delete_database",
        "export_customer_pii"
      ],
      "rate_limit_per_min": 60
    }
  },
  "default": {
    "allowed_tools": [],
    "blocked_tools": [],
    "rate_limit_per_min": 120
  }
}
EOF

log "2/5 Verify governance modules"
for f in nexus_policy_engine.py routes.py nexus_evidence_engine.py __init__.py; do
  [[ -f "nexus_governance/$f" ]] || fail "Missing nexus_governance/$f — scp from local machine"
done
grep -q 'DLP_VIOLATION' nexus_governance/nexus_policy_engine.py || fail "nexus_policy_engine.py outdated"
grep -q 'policy_manager' nexus_governance/routes.py || fail "routes.py missing policy intercept"

log "3/5 Verify Docker config"
grep -q 'COPY config ./config' Dockerfile.fast || fail "Dockerfile.fast missing COPY config"
grep -q './config:/app/config:ro' docker-compose.prod.yml || fail "docker-compose missing config volume"

log "4/5 Rebuild nexus-shield-api (no-cache)"
docker compose --env-file .env -f docker-compose.prod.yml down nexus-shield-api 2>/dev/null || true
docker compose --env-file .env -f docker-compose.prod.yml build --no-cache nexus-shield-api
docker compose --env-file .env -f docker-compose.prod.yml up -d nexus-shield-api nginx-gateway

log "5/5 Validation"
sleep 5
docker exec nexus-shield-api-prod cat /app/config/policies.json | grep -q agent-finance-01

log "DLP block test (:8080)"
_http=$(curl -sS -o /tmp/p2-dlp.out -w '%{http_code}' -X POST http://127.0.0.1:8080/v1/agent/action \
  -H "Content-Type: application/json" \
  -H "X-Nexus-Agent-Id: agent-finance-01" \
  -H "X-Session-Id: sess-p2-002" \
  -d '{"tool_name":"export_customer_pii","arguments":{"user_id":"USR-99"}}')
if [[ "$_http" == "403" ]] && grep -q 'DLP_VIOLATION' /tmp/p2-dlp.out; then
  log "OK — DLP block returned 403 with DLP_VIOLATION"
else
  log "WARN — Expected HTTP 403 + DLP_VIOLATION, got HTTP ${_http}"
  cat /tmp/p2-dlp.out
  exit 1
fi

log "Deploy complete."
