#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

TAPE="docs/demo.tape"
OUTPUT="docs/assets/mcp-shield-demo.gif"

if ! command -v vhs >/dev/null 2>&1; then
  echo "error: vhs is not installed."
  echo "Install: https://github.com/charmbracelet/vhs (also requires ffmpeg)"
  exit 1
fi

if [[ ! -f "$TAPE" ]]; then
  echo "error: tape file not found at $TAPE"
  exit 1
fi

mkdir -p docs/assets

echo "Rendering $TAPE -> $OUTPUT ..."
vhs "$TAPE"

if [[ ! -f "$OUTPUT" ]]; then
  echo "error: expected output not found at $OUTPUT"
  exit 1
fi

if command -v du >/dev/null 2>&1; then
  SIZE="$(du -h "$OUTPUT" | cut -f1)"
  echo "OK: generated $OUTPUT ($SIZE)"
else
  echo "OK: generated $OUTPUT"
fi
