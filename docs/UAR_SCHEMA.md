# Universal Action Receipt (UAR) — canonical product object

Nexus Shield is an **AI Agent Action Governance & Verification Platform**. Every governed **action attempt** and **policy decision** at runtime is sealed as a **UAR** — the primary object in API responses, SIEM exports, and audit trails. UARs are **not** limited to `BLOCK` outcomes; `ALLOW`, `READ_ONLY`, and `REQUIRE_APPROVAL` receive the same cryptographic evidence treatment so auditors can prove what was permitted as well as what was stopped.

## Core tagline

**Know what your agents are allowed to do. Stop what they shouldn't. Prove what actually happened.**

## Canonical fields

| Field | Type | Description |
|---|---|---|
| `receipt_id` | string | Stable identifier (e.g. `uar_…`) |
| `agent_id` | string | Agent subject (`agent.id` in stored receipt) |
| `intent` | string | Declared user / business intent at evaluation time |
| `intent_divergence` | object | Governance context: `risk_score`, `violations`, optional `intent_match_score` / divergence % from runtime evaluate APIs |
| `decision` | enum | `ALLOW` · `BLOCK` · `READ_ONLY` · `REQUIRE_APPROVAL` |
| `execution_state` | object | `before_hash`, `after_hash`, optional `execution_status` |
| `evidence_hash` | string | SHA-256 seal over canonical receipt core (**stored as** `evidence_bundle_hash`) |

## Stored receipt shape (JSON)

```json
{
  "receipt_id": "uar_…",
  "timestamp": "2026-09-27T12:00:00Z",
  "agent": { "id": "tenant:agent-01", "identity_verified": false },
  "intent": "Read-only invoice summary",
  "proposed_action": { "tool": "export_customer_database", "params": {} },
  "policy_evaluated": { "rule_id": "POLICY_BLOCK_CRITICAL", "action": "BLOCK" },
  "decision": "BLOCK",
  "execution_state": {
    "before_hash": "sha256:…",
    "after_hash": "sha256:…",
    "execution_status": "blocked"
  },
  "evidence_bundle_hash": "…"
}
```

## API envelope (data plane / dashboard)

Runtime endpoints return the UAR plus **`intent_divergence`** metadata for auditors:

```json
{
  "decision": "BLOCK",
  "universal_action_receipt": { "...": "canonical stored form above" },
  "intent_divergence": {
    "risk_score": 100,
    "violations": ["INTENT_ACTION_DIVERGENCE", "EXFIL_PATTERN"]
  },
  "cryptography": {
    "receipt_id": "uar_…",
    "evidence_bundle_sha256": "…",
    "independent_verify_url": "https://…/verify?receipt_hash=…&receipt_id=…"
  }
}
```

## Verification

- Recompute hash: [`enterprise/evidence_chain.py`](../enterprise/evidence_chain.py) — `verify_uar_receipt()`
- Local ledger: `enterprise/data/uar_receipts.jsonl`
- Public check: `/verify?receipt_hash=&receipt_id=`

## Evidence bundles vs Proof Center counts

| Artifact | Scope | What gets hashed |
|---|---|---|
| **Harness evidence bundle** | Reproducible benchmark / trajectory evaluation | Every evaluated step in the open-source harness (matches “tool calls analyzed” style metrics) |
| **Production UAR** | Data plane runtime | Every intercepted action attempt → `evidence_bundle_hash` |

Do not equate Proof Center **evidence chain** totals with **blocked action** counts. Do not confuse UAR ledger entries with **harness benchmark scores** — see [BENCHMARK_VS_ACTION_FIREWALL.md](./BENCHMARK_VS_ACTION_FIREWALL.md).
