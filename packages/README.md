# Nexus Shield packages

**Primary product:** [Agent Action Governance & Verification](https://nexus-shield-dashboard.vercel.app) — runtime tool-call decisions, Universal Action Receipts, `READ_ONLY` / `REQUIRE_APPROVAL`, and `POST /api/v1/actions/verify`.

**Security Engines (this folder):** complementary SDKs and integrations for in-RAM PII redaction, IDE scanning, edge guardrails, and local LLM proxies. They do not replace the governance plane; they harden prompts and secrets alongside it.

| Package | Role |
| --- | --- |
| `python/`, `npm/`, `edge/` | PII guardrail proxies |
| `cli/` | Local OpenAI-compatible sanitizer |
| `vscode-extension/` | IDE PII & secret scanning |
| `vercel-integration/` | Vercel Marketplace env wiring |

Canonical latency for agent-action intercept: **P99 runtime intercept: 6.1ms (Nexus benchmark harness)**.
