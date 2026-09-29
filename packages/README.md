# Nexus Shield packages

**Primary product:** [Agent Action Governance & Verification](https://nexus-shield-dashboard.vercel.app) — Action Control Plane: intercept, policy, UAR proof (`POST /api/v1/action/evaluate`, `POST /api/v1/uar/inspect`).

**SDK & bridge:** runtime transition layer between host apps, MCP servers, and the governed agent process — see `python/nexus_shield/action_receipt.py` and `npm/src/action-receipt.ts`.

**Security Engines (supporting):** PII redaction, IDE scanning, edge guardrails, local LLM proxies — not a substitute for action governance.

| Package | Role |
| --- | --- |
| `python/`, `npm/` | Action receipt helpers + optional PII proxy config |
| `edge/` | Edge guardrail patterns |
| `cli/` | Local OpenAI-compatible sanitizer |
| `vscode-extension/` | IDE PII & secret scanning |
| `vercel-integration/` | Vercel Marketplace env wiring |

Canonical latency for agent-action intercept: **P99 runtime intercept: 6.1ms (Nexus benchmark harness)**.
