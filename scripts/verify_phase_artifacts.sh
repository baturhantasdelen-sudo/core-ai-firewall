#!/usr/bin/env bash
# CI/local check — Phase 1-4 reference artifacts present in repo.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
required=(
  nexus-reference-app/docker-compose.yml
  nexus-reference-app/sample_agent.py
  docker-compose.nexus-reference.yml
  docs/under-the-hood.md
  docs/integration-quickstart.md
  docs/architecture-whitepaper.md
  docs/security-benchmarks.md
  examples/mcp_hijack_demo.py
)
for f in "${required[@]}"; do
  [[ -f "$ROOT/$f" ]] || { echo "MISSING: $f"; exit 1; }
done
echo "Phase 1-4 artifact check: OK"
