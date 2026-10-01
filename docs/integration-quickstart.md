# Integration Quickstart — Copy / Paste

Three integration paths for the **Action Control Plane**. All examples default to a **local sidecar** on port **8090** (air-gapped).

---

## 1. Python SDK — `ActionShield`

```python
from nexus import ActionShield

shield = ActionShield(intercept_url="http://127.0.0.1:8090/v1/intercept")

receipt = shield.intercept(
    "Export production database",
    "export_db",
    {"db": "prod"},
)

if shield.allow(receipt):
    # execute tool on host
    ...
else:
    print(receipt["decision"], receipt.get("uar"))
```

Offline fallback uses [`nexus/govern.py`](../nexus/govern.py) + [`harness/core/policy_engine.py`](../harness/core/policy_engine.py) when the sidecar is unreachable.

---

## 2. MCP (Model Context Protocol) — Cursor / Claude Desktop template

Route tool execution through Nexus by pointing your host at the sidecar proxy pattern (stdio or HTTP bridge). Minimal **JSON config shell**:

```json
{
  "mcpServers": {
    "nexus": {
      "command": "python",
      "args": ["-m", "nexus.mcp_bridge"],
      "env": {
        "NEXUS_INTERCEPT_URL": "http://127.0.0.1:8090/v1/intercept",
        "NEXUS_AGENT_ID": "mcp:desktop-agent",
        "NEXUS_AIRGAP": "true"
      }
    }
  }
}
```

For the reference MCP simulator (HTTP), start the stack:

```bash
docker compose -f nexus-reference-app/docker-compose.yml up --build
```

Tool surface: [`nexus-reference-app/mock_mcp_server.py`](../nexus-reference-app/mock_mcp_server.py).

---

## 3. Sidecar HTTP — `POST /v1/intercept`

```bash
curl -sS -X POST "http://127.0.0.1:8090/v1/intercept" \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "tnt_default",
    "agent_id": "curl:demo-agent",
    "user_intent": "Read invoice #8291",
    "tool": "read_invoice",
    "params": { "invoice_id": "8291" }
  }'
```

Response includes `universal_action_receipt`, flat `uar`, and `cryptography.evidence_bundle_sha256`.

Dashboard developer mirror (no API key, local dev):

```bash
curl -sS -X POST "http://localhost:3000/api/v1/uar/inspect" \
  -H "Content-Type: application/json" \
  -d '{
    "user_intent": "Read invoice #8291",
    "tool_call": { "name": "read_invoice", "args": { "invoice_id": "8291" } }
  }'
```

---

## Next steps

| Topic | Doc |
|-------|-----|
| 8-step module map | [under-the-hood.md](./under-the-hood.md) |
| UAR fields | [UAR_SCHEMA.md](./UAR_SCHEMA.md) |
| MCP hijack demo script | [`examples/mcp_hijack_demo.py`](../examples/mcp_hijack_demo.py) |
| GitHub Action verifier | [README](../README.md#github-action--verify-agent-tool-calls-in-ci) |
