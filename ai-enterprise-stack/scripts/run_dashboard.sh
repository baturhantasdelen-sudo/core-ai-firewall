#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
export TELEMETRY_DB_PATH="${TELEMETRY_DB_PATH:-data/telemetry.db}"
export STREAMLIT_BROWSER_GATHER_USAGE_STATS=false
export STREAMLIT_TELEMETRY_ENABLED=false
streamlit run app/dashboard.py \
  --server.port 8501 \
  --server.address localhost \
  --server.headless true \
  --browser.gatherUsageStats false
