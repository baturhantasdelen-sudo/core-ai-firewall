#!/usr/bin/env bash
# Run Nexus Shield Trust Hub demo recordings (Playwright / Chromium).
#
# GCP: port 3000 = Grafana — use TRUST_HUB_URL=http://127.0.0.1:3001/dashboard/trust-hub
#      and start dashboard with: npm run dev -- -p 3001 -H 127.0.0.1
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}/demos"

if [[ -f /opt/nexus-core-firewall/.env ]] && [[ -z "${TRUST_HUB_URL:-}" ]]; then
  export TRUST_HUB_URL="http://127.0.0.1:3001/dashboard/trust-hub"
else
  export TRUST_HUB_URL="${TRUST_HUB_URL:-http://127.0.0.1:3000/dashboard/trust-hub}"
fi
export API_BASE_URL="${API_BASE_URL:-http://127.0.0.1:8080}"
export DEMO_HEADLESS="${DEMO_HEADLESS:-1}"

if [[ ! -d node_modules ]]; then
  npm install
fi

npm run install:browsers
npm run demos

echo "Videos saved under ${ROOT}/demos/videos/"
