# Harness Security & OWASP Mapping

The open-source harness produces **MCP-SEC-SCORE** leaderboard JSON with explicit OWASP classification tags for each scenario.

## Schema (v0.2.0+)

Top-level fields:

- `standards_alignment` — OWASP GenAI Top 10 & Agentic AI frameworks + reference URLs
- `runtime_privacy` — on-device inspection model (`external_cloud_proxy: false`)

Per scenario / leaderboard row:

- `owasp.owasp_genai_top_10` — e.g. `LLM01:2025 Prompt Injection`
- `owasp.owasp_agentic` — e.g. `ASI-01: Agent Goal / Parameter Hijacking`

Mapping logic lives in `runners/owasp_mapping.py`.

## Privacy framing

The harness simulates MCP JSON-RPC locally. It does **not** exfiltrate scenario payloads to Nexus Shield cloud services. This supports reproducible audits in restricted environments.

## References

- [OWASP AI Agent Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/AI_Agent_Security_Cheat_Sheet.html)
- [OWASP Agentic AI Threats and Mitigations](https://owasp.org/www-project-agentic-ai/)
