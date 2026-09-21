#!/usr/bin/env bash
set -euo pipefail

REPO="${1:-baturhantasdelen-sudo/harness}"

if ! command -v gh >/dev/null 2>&1; then
  echo "error: gh CLI is not installed."
  echo "Install: https://cli.github.com/"
  exit 1
fi

echo "Applying GitHub topics to $REPO ..."
gh repo edit "$REPO" \
  --add-topic mcp,model-context-protocol,llm-security,prompt-injection,security-benchmark,mcp-security,ai-security

echo "OK: topics applied to $REPO"
