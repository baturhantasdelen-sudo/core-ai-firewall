#!/usr/bin/env bash
# run_proof_center_benchmark.sh — Proof Center benchmark on GCP or local Fast API
#
# Usage:
#   bash scripts/run_proof_center_benchmark.sh
#   BASE_URL=https://api.nexusshield.ai bash scripts/run_proof_center_benchmark.sh

set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:8080}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="${DEPLOY_DIR:-/opt/nexus-core-firewall}"
if [[ -d "${DEPLOY_DIR}/data" ]]; then
  OUT_FILE="${OUT_FILE:-${DEPLOY_DIR}/data/proof_center_benchmark.json}"
else
  OUT_FILE="${OUT_FILE:-/tmp/proof_center_benchmark.json}"
fi

python3 "${SCRIPT_DIR}/run_proof_center_benchmark.py" \
  --base-url "${BASE_URL}" \
  --json-out "${OUT_FILE}"

echo "Proof Center metrics: ${OUT_FILE}"
