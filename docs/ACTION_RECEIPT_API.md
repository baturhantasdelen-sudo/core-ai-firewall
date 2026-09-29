# Action Receipt API (living standard)

Cross-layer JSON envelope for **Agent Action Governance & Verification**. Implemented in Python SDK, npm bridge, data plane responses, and dashboard inspect endpoint.

Schema: [schemas/uar_action_receipt.schema.json](../schemas/uar_action_receipt.schema.json)

## Fields

| Field | Description |
|---|---|
| `action_id` | Same as `receipt_id` in stored UAR |
| `agent_id` | Governed agent |
| `intent` | Declared user / business intent |
| `tool` | `{ name, params }` proposed call |
| `authorization` | `approved` · `blocked` · `read_only` · `approval_required` |
| `policy` | `passed` or `failed` |
| `execution` | `success` · `failure` · `blocked` · `pending` |
| `before_state_hash` / `after_state_hash` | State digests |
| `evidence_hash` | SHA-256 seal (`evidence_bundle_hash`) |
| `timestamp` | ISO-8601 UTC |
| `signature` | Evidence signature reference (matches `evidence_hash` when HMAC not configured) |

## Local inspect (developers)

**Dashboard (no API key):**

```bash
curl -s -X POST http://localhost:3000/api/v1/uar/inspect \
  -H "Content-Type: application/json" \
  -d '{"agent_id":"demo:agent-01","user_intent":"Read-only summary","tool_call":{"name":"export_db","args":{}}}'
```

**Data plane:**

```bash
curl -s -X POST http://localhost:8090/v1/intercept \
  -H "Content-Type: application/json" \
  -d '{"agent_id":"tnt_default:agent-01","user_intent":"Read-only summary","tool":"export_db","params":{}}'
```

Python SDK: `nexus_shield.action_receipt.inspect_action(...)`

Node bridge: `inspectActionReceipt(...)` from `@nexus-shield/sdk-bridge`
