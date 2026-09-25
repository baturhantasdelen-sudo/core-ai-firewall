# Security & Standards Alignment

Nexus Shield is an **AI Agent Runtime Control & Trust Layer** designed for restricted enterprise, public sector, and defense-adjacent deployments.

## On-device privacy model

- **Sub-millisecond token / tool-call inspection** at the customer runtime boundary (agent host, MCP sidecar, or mobile on-device firewall).
- **No mandatory external cloud proxy** for policy evaluation — prompts and tool payloads are not required to transit Nexus Shield SaaS for block/allow decisions.
- **Data residency** remains under customer control; evidence bundles are generated locally for audit export.

Cloud-hosted dashboard and Proof Center features are optional telemetry surfaces; runtime enforcement is architected for air-gapped and critical-infrastructure compatible deployments.

## OWASP alignment

Detections and benchmark artifacts map intercepted threats to:

| Framework | Examples |
|-----------|----------|
| **OWASP GenAI Top 10** | LLM01 Prompt Injection, LLM02 Sensitive Information Disclosure, LLM06 Excessive Agency |
| **OWASP Agentic AI Threats & Mitigations** | ASI-01 Agent Goal / Parameter Hijacking, ASI-02 Cross-Tool Data Leakage, ASI-03 Permission & Scope Violation |

Official references:

- [OWASP GenAI / LLM Top 10](https://genai.owasp.org/llmrisk/llm01-prompt-injection/)
- [OWASP Agentic AI Project](https://owasp.org/www-project-agentic-ai/)
- [OWASP AI Agent Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/AI_Agent_Security_Cheat_Sheet.html)

Harness JSON exports (`mcp_leaderboard.json`, `scorecard_2026.json`) include `owasp`, `standards_alignment`, and `runtime_privacy` metadata for GRC ingestion.

## Reporting vulnerabilities

Report security issues privately via GitHub Security Advisories on this repository or contact **security@nexusshield.ai** (replace with your operational address). Do not open public issues for exploitable findings.

## Reproducible verification

```bash
docker run --rm ghcr.io/baturhantasdelen-sudo/harness:latest --eval-mcp
docker run --rm ghcr.io/baturhantasdelen-sudo/harness:latest --eval-scorecard
```
