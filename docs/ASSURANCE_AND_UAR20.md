# Business Action Assurance, UAR 2.0, and Proof Center

Nexus Shield elevates agent governance from **action control** to **business action assurance**: every material claim is checked against an **authoritative system of record**, with vendor-neutral **UAR 2.0** receipts and **Proof Center** exports for auditors.

> **DO NOT TRUST THE AGENT. DO NOT TRUST THE TOOL RESPONSE. VERIFY THE WORLD.**

## Phase 1 — Assurance Core (`lib/nexus-core/assurance/`)

| File | Responsibility |
|------|----------------|
| `authoritative-sources.ts` | Maps fields (`payment_status`, `invoice_balance`, `segment`, …) → vertical SoT |
| `engine.ts` | Rule evaluation: 11 operators + `GREATER`/`LESS` aliases, `ALL` / `ANY` |
| `side-effects.ts` | Expected vs. actual mutations; forbidden fields; bulk update detection |
| `runner.ts` | End-to-end assurance run + false-success detection |

## Phase 2 — Vertical adapters (`lib/nexus-core/adapters/vertical/`)

Read-only adapters (no writes during verification):

| Adapter | Actions | Validates |
|---------|---------|-----------|
| **Finance** | `create_payment`, `create_refund`, `transfer_funds` | Amount, currency, customer, invoice, ledger |
| **ERP** | `close_invoice`, `update_invoice`, `reconcile_balance` | Invoice status, balance, tamper flags |
| **CRM** | `update_profile`, `change_segment`, `bulk_sync` | Segment, shadow fields, bulk patterns |

## Phase 3 — UAR 2.0 (`lib/nexus-core/uar/`)

UAR 2.0 separates:

- **`action`** — what happened (tool, transaction, executed flag)
- **`verification`** — was it verified (multi-source reads, diffs, false-success flag)

Integrity: `parameter_hash`, `outcome_hash`, `evidence_hash`, `receipt_body_hash`, `previous_uar_hash` chain. Signatures: Ed25519-SHA256 demo material (`signatures.public_key_id`).

Offline verification:

```bash
cd nexus-shield-dashboard
npm run nexus-proof -- path/to/proof.json
```

## Phase 4 — Proof Center (`lib/nexus-core/proof/` + API)

| Endpoint | Description |
|----------|-------------|
| `GET /api/v1/proof/{transaction_id}` | Each claim + authoritative source, timestamps, match flag |
| `GET /api/v1/proof/{transaction_id}/export` | `proof.json` + manifest for external CISO review |

Integrity block: `signature_valid`, `chain_valid`, `authority_valid`, `hash_chain_valid`.

Pipeline evaluate (`POST /api/v1/action/evaluate`) builds UAR 2.0 and persists proof keyed by `transaction_id`.

## Phase 5 — A2B benchmark (`lib/nexus-core/benchmark/`)

**Independent Agent Action Assurance Benchmark (A2B):** 20 open fixtures — **8 Finance**, **7 ERP**, **5 CRM**.

```bash
cd nexus-shield-dashboard
npm run test:benchmark
```

| Metric | Target (fixed suite) |
|--------|----------------------|
| Scenario pass rate | **20 / 20** |
| False Success Detection Rate | **100%** |
| Outcome Verification Accuracy | **100%** |

Scenario definitions: `a2b-scenarios.ts` · Runner: `runner.ts` · Metrics: `metrics.ts`.

## Compatibility

- Existing **outcome** engine and **`test:nexus-core` (24/24)** remain unchanged.
- **UAR v2** receipts from evaluate are still returned as `uar_v2_receipt`; UAR 2.0 is additive on `SevenEnginePipelineResult.uar20`.

## Related

- [benchmark-2027.md](./benchmark-2027.md) — 12 outcome verification scenarios
- [BENCHMARK.md](../BENCHMARK.md) — public benchmark index
- [UAR_SCHEMA.md](./UAR_SCHEMA.md) — canonical receipt fields (v1/v2 alignment)
