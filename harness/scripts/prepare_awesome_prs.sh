#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

MCP_TEMPLATE="$ROOT/docs/awesome_list_prs/awesome-mcp-servers-pr.md"
LLM_TEMPLATE="$ROOT/docs/awesome_list_prs/awesome-llm-security-pr.md"

extract_markdown_entry() {
  awk '/^```markdown\r?$/{capture=1; next} capture && /^```\r?$/{exit} capture {gsub(/\r$/, "")} capture' "$1"
}

print_section() {
  echo
  echo "================================================================"
  echo "$1"
  echo "================================================================"
}

if ! command -v gh >/dev/null 2>&1; then
  echo "warning: gh CLI not found — commands below are ready to copy once gh is installed."
fi

MCP_ENTRY="$(extract_markdown_entry "$MCP_TEMPLATE" | sed '/^$/d' | head -n 1)"
LLM_ENTRY="$(extract_markdown_entry "$LLM_TEMPLATE" | sed '/^$/d' | head -n 1)"
MCP_TITLE="docs: add Nexus Shield MCP Security Harness to Security & Testing"
LLM_TITLE="docs: add MCP-SEC-SCORE harness to Benchmark"

MCP_BODY_FILE="$(mktemp)"
LLM_BODY_FILE="$(mktemp)"
trap 'rm -f "$MCP_BODY_FILE" "$LLM_BODY_FILE"' EXIT

cat >"$MCP_BODY_FILE" <<EOF
## Summary

Adds the Nexus Shield MCP Security Harness — an open-source benchmark suite for MCP server security.

- Evaluates indirect prompt injection, cross-tool exfiltration, and privilege escalation
- Publishes MCP-SEC-SCORE (0–100) with letter grades
- Live leaderboard: https://nexusshield.ai/docs/benchmark

## Entry

\`\`\`markdown
$MCP_ENTRY
\`\`\`
EOF

cat >"$LLM_BODY_FILE" <<EOF
## Summary

Adds the Nexus Shield MCP Security Harness with the standardized **MCP-SEC-SCORE** metric for evaluating LLM agent + MCP tool chain security.

Repository: https://github.com/baturhantasdelen-sudo/harness  
Live results: https://nexusshield.ai/docs/benchmark

## Entry

\`\`\`markdown
$LLM_ENTRY
\`\`\`
EOF

print_section "awesome-mcp-servers — markdown entry (Security & Testing)"
echo "$MCP_ENTRY"

print_section "awesome-mcp-servers — gh commands (punkpeye/awesome-mcp-servers)"
cat <<EOF
gh repo fork punkpeye/awesome-mcp-servers --clone --remote
git -C awesome-mcp-servers checkout -b add-nexus-shield-harness
# Add under **Security & Testing** in README.md:
# $MCP_ENTRY
git -C awesome-mcp-servers add README.md
git -C awesome-mcp-servers commit -m "$MCP_TITLE"
git -C awesome-mcp-servers push -u origin add-nexus-shield-harness
gh pr create --repo punkpeye/awesome-mcp-servers \\
  --head "\$(gh api user --jq .login):add-nexus-shield-harness" \\
  --title "$MCP_TITLE" \\
  --body-file "$MCP_BODY_FILE"
EOF

print_section "awesome-mcp-servers — gh commands (wong2/awesome-mcp-servers)"
cat <<EOF
gh repo fork wong2/awesome-mcp-servers --clone=false
git clone "https://github.com/\$(gh api user --jq .login)/awesome-mcp-servers.git" awesome-mcp-servers-wong2
git -C awesome-mcp-servers-wong2 checkout -b add-nexus-shield-harness
# Add under **Security & Testing** in README.md:
# $MCP_ENTRY
git -C awesome-mcp-servers-wong2 add README.md
git -C awesome-mcp-servers-wong2 commit -m "$MCP_TITLE"
git -C awesome-mcp-servers-wong2 push -u origin add-nexus-shield-harness
gh pr create --repo wong2/awesome-mcp-servers \\
  --head "\$(gh api user --jq .login):add-nexus-shield-harness" \\
  --title "$MCP_TITLE" \\
  --body-file "$MCP_BODY_FILE"
EOF

print_section "awesome-llm-security — markdown entry (Benchmark)"
echo "$LLM_ENTRY"

print_section "awesome-llm-security — gh commands (corca-ai/awesome-llm-security)"
cat <<EOF
gh repo fork corca-ai/awesome-llm-security --clone --remote
git -C awesome-llm-security checkout -b add-nexus-shield-mcp-sec-score
# Add under **Benchmark** in README.md:
# $LLM_ENTRY
git -C awesome-llm-security add README.md
git -C awesome-llm-security commit -m "$LLM_TITLE"
git -C awesome-llm-security push -u origin add-nexus-shield-mcp-sec-score
gh pr create --repo corca-ai/awesome-llm-security \\
  --head "\$(gh api user --jq .login):add-nexus-shield-mcp-sec-score" \\
  --title "$LLM_TITLE" \\
  --body-file "$LLM_BODY_FILE"
EOF

echo
echo "PR body files (for --body-file):"
echo "  MCP: $MCP_BODY_FILE"
echo "  LLM: $LLM_BODY_FILE"
