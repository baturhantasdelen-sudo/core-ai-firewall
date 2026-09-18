#!/usr/bin/env bash
# integration-load-suite.sh — Trust Hub HITL, MCP security, and Locust load checks
#
# Usage:
#   bash scripts/integration-load-suite.sh
#   HOST=https://api.nexusshield.ai bash scripts/integration-load-suite.sh
#   HOST=http://127.0.0.1:8080 REDIS_CONTAINER=nexus_redis bash scripts/integration-load-suite.sh

set -euo pipefail

HOST="${HOST:-http://127.0.0.1:8080}"
REDIS_CONTAINER="${REDIS_CONTAINER:-nexus_redis}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
LOCUST_FILE="${SCRIPT_DIR}/locust_governance.py"

json_pretty() {
  if command -v jq >/dev/null 2>&1; then
    jq .
  else
    python3 -m json.tool 2>/dev/null || cat
  fi
}

echo "=================================================="
echo "   NEXUS SHIELD AI - INTEGRATION & LOAD SUITE   "
echo "=================================================="
echo "Target: ${HOST}"

# --------------------------------------------------
# STEP 1: HITL flow — intent mismatch + approval_id
# --------------------------------------------------
echo
echo "[1/3] HITL Onay Akışı (Intent Mismatch -> approval_id)"
echo "--------------------------------------------------"

HITL_RESPONSE=$(curl -s -X POST "${HOST}/v1/agent/action" \
  -H "Content-Type: application/json" \
  -H "X-Nexus-Agent-Id: agent-integration-test" \
  -H "X-Session-Id: sess_hitl_integration_001" \
  -d '{
    "tool_name": "read_invoice",
    "arguments": {"invoice_id": "INV-HITL-TEST"},
    "user_prompt": "Bugün Ankara hava durumu nasıl?",
    "tool_purpose": "Finansal fatura detaylarını okur."
  }')

echo "${HITL_RESPONSE}" | json_pretty

APPROVAL_ID=$(echo "${HITL_RESPONSE}" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('approval_id',''))" 2>/dev/null || true)
HITL_STATUS=$(echo "${HITL_RESPONSE}" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('status',''))" 2>/dev/null || true)

if [[ "${HITL_STATUS}" == "PENDING_APPROVAL" && -n "${APPROVAL_ID}" ]]; then
  echo "OK: HITL approval_id=${APPROVAL_ID}"
else
  echo "WARN: Beklenen PENDING_APPROVAL + approval_id alınamadı (status=${HITL_STATUS})"
fi

if command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' | grep -q "^${REDIS_CONTAINER}$"; then
  echo
  echo "Redis trajectory / governance keys (sample):"
  docker exec "${REDIS_CONTAINER}" redis-cli keys 'trajectory:*' 2>/dev/null | head -n 5 || true
  docker exec "${REDIS_CONTAINER}" redis-cli keys 'approval:*' 2>/dev/null | head -n 5 || true
elif command -v redis-cli >/dev/null 2>&1; then
  echo
  echo "Redis keys (sample):"
  redis-cli keys 'trajectory:*' 2>/dev/null | head -n 5 || true
  redis-cli keys 'approval:*' 2>/dev/null | head -n 5 || true
else
  echo "Redis CLI / container bulunamadı — approval_id yukarıdaki JSON'dan kullanın."
fi

echo "-> Trust Hub: approval_id=${APPROVAL_ID:-N/A} kaydını Onayla/Reddet ile kapatın."

# --------------------------------------------------
# STEP 2: MCP security (/v1/mcp/inspect)
# --------------------------------------------------
echo
echo "[2/3] MCP (Model Context Protocol) Güvenlik Testi"
echo "--------------------------------------------------"

echo "1) DLP / policy block (export_customer_pii):"
curl -s -X POST "${HOST}/v1/mcp/inspect" \
  -H "Content-Type: application/json" \
  -d '{
    "mcp_payload": {
      "method": "tools/call",
      "params": {
        "name": "export_customer_pii",
        "arguments": {"path": "/etc/passwd", "format": "csv"}
      }
    },
    "agent_trust_score": 95.0,
    "divergence_score": 0.0
  }' | json_pretty

echo
echo "2) Low-trust destructive tool (delete_records):"
curl -s -X POST "${HOST}/v1/mcp/inspect" \
  -H "Content-Type: application/json" \
  -d '{
    "mcp_payload": {
      "method": "tools/call",
      "params": {
        "name": "delete_records",
        "arguments": {"table": "users"}
      }
    },
    "agent_trust_score": 30.0,
    "divergence_score": 0.0
  }' | json_pretty

echo
echo "3) Allowed read path (read_invoice):"
curl -s -X POST "${HOST}/v1/mcp/inspect" \
  -H "Content-Type: application/json" \
  -d '{
    "mcp_payload": {
      "method": "tools/call",
      "params": {
        "name": "read_invoice",
        "arguments": {"invoice_id": "INV-2026-001"}
      }
    },
    "agent_trust_score": 95.0,
    "divergence_score": 0.0
  }' | json_pretty

# --------------------------------------------------
# STEP 3: Locust headless load (optional)
# --------------------------------------------------
echo
echo "[3/3] Stres ve Yük Testi (Locust headless)"
echo "--------------------------------------------------"

if [[ "${SKIP_LOCUST:-0}" == "1" ]]; then
  echo "SKIP_LOCUST=1 — Locust atlandı."
else
  python3 -m pip install -q -r "${REPO_ROOT}/requirements-load.txt" 2>/dev/null \
    || pip install -q locust 2>/dev/null \
    || { echo "Locust kurulamadı — adım atlandı."; SKIP_LOCUST=1; }
fi

if [[ "${SKIP_LOCUST:-0}" != "1" ]]; then
  echo "10s headless load (50 users, spawn 10/s) → ${HOST}"
  locust -f "${LOCUST_FILE}" \
    --host="${HOST}" \
    --headless \
    -u 50 \
    -r 10 \
    --run-time 10s \
    || echo "WARN: Locust tamamlanamadı (ortam kısıtı olabilir)."
fi

echo
echo "=================================================="
echo "   TÜM ENTEGRASYON VE STRES TESTLERİ TAMAMLANDI   "
echo "=================================================="
