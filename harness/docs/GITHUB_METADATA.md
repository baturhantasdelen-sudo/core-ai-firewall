# GitHub Repository Metadata

Configure topics and description for **baturhantasdelen-sudo/harness**.

## Repository settings

**GitHub → Repository → ⚙ Settings → General**

| Field | Value |
|---|---|
| **Description** | Open-source MCP security benchmark harness — indirect prompt injection, cross-tool exfiltration, MCP-SEC-SCORE leaderboard |
| **Website** | https://nexusshield.ai/docs/benchmark |
| **Topics** | see below |

## Required topics (copy-paste into Topics field)

```
mcp
model-context-protocol
llm-security
prompt-injection
ai-security
security-benchmark
mcp-security
```

### Optional additional topics

```
agent-security
red-team
benchmark
json-rpc
tool-hijacking
nexus-shield
```

## CLI (alternative)

```bash
gh repo edit baturhantasdelen-sudo/harness \
  --description "Open-source MCP security benchmark harness — MCP-SEC-SCORE leaderboard" \
  --homepage "https://nexusshield.ai/docs/benchmark" \
  --add-topic mcp,model-context-protocol,llm-security,prompt-injection,ai-security,security-benchmark,mcp-security
```

## Social preview

- **Image:** `docs/assets/mcp-shield-demo.gif` (after recording)
- **Title:** Nexus Shield MCP Security Harness
- **Subtitle:** Benchmark MCP servers against tool-hijacking attacks
