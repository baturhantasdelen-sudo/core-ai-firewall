#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

TAPE="docs/demo.tape"
CAST="docs/assets/demo.cast"
OUTPUT="docs/assets/mcp-shield-demo.gif"
AGG_VERSION="v1.9.0"

mkdir -p docs/assets

render_with_vhs() {
  if ! command -v vhs >/dev/null 2>&1; then
    return 1
  fi
  echo "Rendering $TAPE -> $OUTPUT (vhs) ..."
  vhs "$TAPE"
  [[ -f "$OUTPUT" ]]
}

ensure_agg() {
  if command -v agg >/dev/null 2>&1; then
    return 0
  fi
  local cache="${ROOT}/.tools/agg"
  if [[ -x "${cache}/agg" ]]; then
    export PATH="${cache}:${PATH}"
    return 0
  fi
  mkdir -p "$cache"
  local url="https://github.com/asciinema/agg/releases/download/${AGG_VERSION}/agg-x86_64-unknown-linux-gnu"
  echo "Downloading agg ${AGG_VERSION} ..."
  curl -fsSL -o "${cache}/agg" "$url"
  chmod +x "${cache}/agg"
  export PATH="${cache}:${PATH}"
}

render_with_agg() {
  ensure_agg
  echo "Exporting cast -> $CAST ..."
  python3 scripts/export_demo_cast.py --output "$CAST" --speed fast
  echo "Rendering $CAST -> $OUTPUT (agg) ..."
  agg "$CAST" "$OUTPUT"
  [[ -f "$OUTPUT" ]]
}

if [[ ! -f "$TAPE" ]]; then
  echo "error: tape file not found at $TAPE"
  exit 1
fi

if render_with_vhs; then
  :
elif render_with_agg; then
  echo "note: vhs unavailable or failed; used agg fallback"
else
  echo "error: failed to generate $OUTPUT"
  echo "Install vhs: https://github.com/charmbracelet/vhs"
  echo "Fallback requires: python3, curl, agg (auto-downloaded on Linux/WSL)"
  exit 1
fi

if command -v du >/dev/null 2>&1; then
  SIZE="$(du -h "$OUTPUT" | cut -f1)"
  echo "OK: generated $OUTPUT ($SIZE)"
else
  echo "OK: generated $OUTPUT"
fi
