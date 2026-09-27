#!/usr/bin/env bash
# Record-friendly terminal walkthrough for a critical 0-day AI agent preset.
# Usage (from repo root): bash scripts/record_demo_terminal.sh
# Tip: maximize terminal font, dark theme, 80+ cols for clean capture.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PRESET_ID="cve-2026-critical-zero-day"
PAUSE="${NEXUS_DEMO_PAUSE_SEC:-2}"

# Colors (disabled if NO_COLOR is set)
if [[ -n "${NO_COLOR:-}" ]]; then
  RED="" GREEN="" YELLOW="" CYAN="" MAGENTA="" BOLD="" DIM="" RESET=""
else
  RED='\033[0;31m'
  GREEN='\033[0;32m'
  YELLOW='\033[1;33m'
  CYAN='\033[0;36m'
  MAGENTA='\033[0;35m'
  BOLD='\033[1m'
  DIM='\033[2m'
  RESET='\033[0m'
fi

pause() {
  sleep "$PAUSE"
}

section() {
  echo ""
  echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
  echo -e "${CYAN}${BOLD}  $1${RESET}"
  echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
  echo ""
  pause
}

step() {
  echo -e "${DIM}▸${RESET} $1"
  pause
}

echo -e "${MAGENTA}${BOLD}"
echo "  ╔══════════════════════════════════════════════════════════╗"
echo "  ║  Nexus Shield — Detect & Demonstrate (0-Day Preset PoC)   ║"
echo "  ╚══════════════════════════════════════════════════════════╝"
echo -e "${RESET}"
pause

section "1 · Threat preset (CVE exploit database)"
step "Preset ID: ${BOLD}${PRESET_ID}${RESET}"
step "Scenario: indirect prompt injection → MCP tool hijack → unauthorized DB export"
echo -e "${YELLOW}  Loading ${PRESET_ID}.preset.json from presets/${RESET}"
pause

section "2 · Run harness policy engine + seal UAR"
echo -e "${DIM}  $ python scripts/simulate_vulnerability_preset.py --preset ${PRESET_ID} --write-public-json${RESET}"
echo ""
pause

python scripts/simulate_vulnerability_preset.py --preset "${PRESET_ID}" --write-public-json

section "3 · Independent verification (public /verify)"
PROOF_JSON="nexus-shield-dashboard/public/demo/presets/${PRESET_ID}.proof.json"
if [[ -f "$PROOF_JSON" ]]; then
  HASH="$(python -c "import json; print(json.load(open('$PROOF_JSON', encoding='utf-8'))['evidence_bundle_sha256'])")"
  RID="$(python -c "import json; print(json.load(open('$PROOF_JSON', encoding='utf-8'))['receipt_id'])")"
  URL="$(python -c "import json; print(json.load(open('$PROOF_JSON', encoding='utf-8'))['verification_url'])")"
  DECISION="$(python -c "import json; print(json.load(open('$PROOF_JSON', encoding='utf-8'))['mitigation']['decision'])")"
  echo -e "${GREEN}${BOLD}  Decision:${RESET} ${RED}${DECISION}${RESET}"
  echo -e "${GREEN}${BOLD}  Receipt ID:${RESET} ${RID}"
  echo -e "${GREEN}${BOLD}  SHA-256:${RESET}    ${HASH}"
  echo ""
  echo -e "${GREEN}${BOLD}  Vercel verify URL:${RESET}"
  echo -e "  ${CYAN}${URL}${RESET}"
else
  echo -e "${RED}Proof bundle not found at ${PROOF_JSON}${RESET}" >&2
  exit 1
fi

echo ""
echo -e "${MAGENTA}${BOLD}  ✓ Recording sequence complete — open /demo on the dashboard to select this preset.${RESET}"
echo ""
