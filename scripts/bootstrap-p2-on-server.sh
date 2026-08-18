#!/usr/bin/env bash
# bootstrap-p2-on-server.sh — Create P2 policy files under /opt/nexus-core-firewall
#
# Usage (GCP browser SSH or production shell):
#   cd /opt/nexus-core-firewall
#   sudo bash scripts/bootstrap-p2-on-server.sh
#
# Optional: sync governance Python from local repo checkout on server:
#   REPO_SRC=/path/to/core-ai-firewall sudo bash scripts/bootstrap-p2-on-server.sh

set -euo pipefail

DEPLOY_PATH="${DEPLOY_PATH:-/opt/nexus-core-firewall}"
REPO_SRC="${REPO_SRC:-$DEPLOY_PATH}"
cd "$DEPLOY_PATH"

log() { echo "[bootstrap-p2] $*"; }

mkdir -p config nexus_governance

log "Writing config/policies.json"
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

GOV_FILES=(
  nexus_policy_engine.py
  routes.py
  nexus_evidence_engine.py
  __init__.py
)

log "Installing nexus_governance Python modules"
for file_name in "${GOV_FILES[@]}"; do
  src="$REPO_SRC/nexus_governance/$file_name"
  dest="nexus_governance/$file_name"
  if [[ -f "$src" ]]; then
    install -m 644 "$src" "$dest"
    log "  OK $dest"
  elif [[ -f "$dest" ]]; then
    log "  SKIP $dest (already exists)"
  else
    log "  MISSING $src — upload nexus_governance/$file_name from local machine"
    exit 1
  fi
done

log "Verifying policies.json"
python3 - << 'PY'
import json
from pathlib import Path

path = Path("config/policies.json")
data = json.loads(path.read_text(encoding="utf-8"))
assert "agent-finance-01" in data["policies"]
assert data["policies"]["agent-finance-01"]["rate_limit_per_min"] == 60
print("policies.json OK")
PY

log "Rebuild nexus-shield-api (no-cache)"
docker compose --env-file .env -f docker-compose.prod.yml build --no-cache nexus-shield-api
docker compose --env-file .env -f docker-compose.prod.yml up -d nexus-shield-api nginx-gateway

log "Container policy file:"
docker exec nexus-shield-api-prod cat /app/config/policies.json

log "Done — test with:"
cat << 'TEST'

curl -i -X POST http://127.0.0.1:8080/v1/agent/action \
  -H "Content-Type: application/json" \
  -H "X-Nexus-Agent-Id: agent-finance-01" \
  -H "X-Session-Id: sess-p2-001" \
  -d '{"tool_name":"read_invoice","arguments":{"invoice_id":"INV-2026"}}'

curl -i -X POST http://127.0.0.1:8080/v1/agent/action \
  -H "Content-Type: application/json" \
  -H "X-Nexus-Agent-Id: agent-finance-01" \
  -H "X-Session-Id: sess-p2-002" \
  -d '{"tool_name":"export_customer_pii","arguments":{"user_id":"USR-99"}}'

TEST
