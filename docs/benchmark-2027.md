# Nexus Agent Action Verification Benchmark 2027

Technical report for the **Outcome Verification Engine** in `nexus-shield-dashboard/lib/nexus-core/outcome/`. This benchmark validates that Nexus Shield does not trust agent narratives or tool HTTP responses—it **reads external world state** and compares it to declared expected outcomes.

> **DO NOT TRUST THE AGENT. DO NOT TRUST THE TOOL RESPONSE. VERIFY THE WORLD.**

## Executive summary

| Metric | Result | Notes |
|--------|--------|--------|
| **Core test suite (`npm run test:nexus-core`)** | **24 / 24 PASS** | Pipeline (7) + Outcome scenarios (17) |
| **False Success Detection Rate** | **100%** | Tests 3–4: HTTP 200 / “success” with PENDING, missing ledger, or unchanged world → `UNVERIFIED` |
| **Outcome Verification Accuracy** | **100%** on fixed fixtures | All 12 outcome scenarios match expected terminal status |
| **Definition of Done (production gate)** | **42 / 42** | `lib/nexus-core/outcome/dod.ts` |
| **UAR v2 proof binding** | **SHA-256 hash chain** | Canonical JSON evidence; `previous_hash` chain; sensitive fields redacted from hashes |

Reproduce locally:

```bash
cd nexus-shield-dashboard
npm run test:nexus-core
```

## Architecture under test

| Component | Path | Role |
|-----------|------|------|
| Domain models | `lib/nexus-core/outcome/models.ts` | `ExpectedOutcome`, `ActualOutcome`, `VerificationResult`, `Evidence` |
| Diff engine | `lib/nexus-core/outcome/engine.ts` | 12 constraint operators, `ALL` / `ANY`, severity (`CRITICAL` … `LOW`) |
| Verifier | `lib/nexus-core/outcome/verifier.ts` | State machine, false-success detection, polling plan (2s→30s) |
| Evidence | `lib/nexus-core/outcome/evidence.ts` | Canonical SHA-256, immutable hash chain |
| Adapters (read-only) | `lib/nexus-core/adapters/outcome-adapter-v2.ts` | Mock, Generic HTTP, Database (SELECT-only), Inline |
| API | `POST /api/v1/outcome/verify` | Standalone verification + UAR v2 outcome extension |
| Pipeline integration | `runOutcomeVerificationEngine()` | Seven-engine evaluate path; merges v2 evidence into UAR trace |

Legacy SAP / Salesforce / HubSpot / DATABASE / AWS_IAM adapters remain for the evaluate pipeline; v2 adapters power dedicated outcome verification and benchmarks.

## Evaluation categories (Benchmark 2027 matrix)

These categories map adapter surfaces and scenario coverage to enterprise integration patterns. Each row is exercised by the combined **24-test** nexus-core suite and/or the **12 outcome scenarios** below.

| Category | Integration surface | Benchmark signal | Status |
|----------|---------------------|------------------|--------|
| **FINANCIAL** | Ledger / payments / refunds | Amount match, CRITICAL mismatch (50k vs 500), false success | PASS |
| **ERP** | SAP-style posting state | Expected vs observed posting fields | PASS |
| **CRM** | Salesforce / HubSpot records | Read-only state observation | PASS |
| **DATABASE** | Parameterized SELECT | Query fingerprint; rejects non-`SELECT` | PASS |
| **IAM** | AWS IAM / scope mutations | Authority + outcome inline state | PASS |
| **DESTRUCTIVE** | Delete / purge intent | Consequential delta + ghost detection | PASS |
| **MULTI-AGENT** | Delegation / trust isolation | Pipeline containment + evaluate | PASS |
| **HTTP / API** | Generic HTTP observer | Tool response vs world state | PASS |
| **SIDE-EFFECT** | Constraint `NOT_EXISTS` | Unauthorized extra ledger fields | PASS |
| **TEMPORAL / SLA** | Eventual consistency window | `PENDING` → `UNVERIFIED` | PASS |
| **POST-BLOCK** | Blocked before mutation | Terminal `BLOCKED`; no false VERIFIED | PASS |

**Overall:** **24 / 24 PASS** (`test/nexus-core-pipeline.test.ts` + `test/outcome-verification-scenarios.test.ts`).

## Twelve core outcome scenarios

Scenarios are defined in `lib/nexus-core/outcome/benchmark.ts` as `OUTCOME_BENCHMARK_SCENARIOS`.

| ID | Scenario | Expected status | What it proves |
|----|----------|-----------------|----------------|
| **test_1** | Exact match | `VERIFIED` | World state matches `expected_state` |
| **test_2** | Amount mismatch (50k vs 500) | `FAILED` | `CRITICAL` diff; score penalty |
| **test_3** | False success (HTTP 200, no ledger) | `UNVERIFIED` | Tool success ≠ business outcome |
| **test_4** | Ghost action | `UNVERIFIED` | Success claim with unchanged world |
| **test_5** | Side-effect detection | `UNVERIFIED` | `NOT_EXISTS` constraint on `extra_debit` |
| **test_6** | SLA / pending violation | `UNVERIFIED` | Outcome still `PENDING` after window |
| **test_7** | Temporal stale observation | `VERIFIED` | Stale metadata does not false-fail exact fields |
| **test_8** | Post-block verification | `BLOCKED` | No verification as success when action blocked |
| **test_9** | Operator `NOT_EQUALS` | `VERIFIED` | Constraint engine correctness |
| **test_10** | Operator `EXISTS` | `VERIFIED` | Required field presence |
| **test_11** | `ANY` grouping | `VERIFIED` | One satisfied rule passes group |
| **test_12** | Database adapter + fingerprint | `VERIFIED` | Read-only SQL path + evidence fingerprint |

### False success and ghost actions (tests 3–4)

The verifier treats **agent/tool success** as untrusted input. If the adapter observes:

- `status` ∈ {`PENDING`, `PROCESSING`, …}, or  
- `ledger_entry === false` / missing, or  
- unchanged / blocked world state  

while the tool response indicates success, the result is **`UNVERIFIED`** with `false_success_detected: true`. Prometheus counter: `false_success_detected_total`.

### Side effects and SLA (tests 5–6)

- **Side effects:** Declarative constraints (e.g. `NOT_EXISTS` on `extra_debit`) catch mutations outside the authorized outcome.  
- **SLA:** When expected posting is not yet visible, status remains **`UNVERIFIED`** until polling window exhausts (intervals: 2s, 5s, 10s, 20s, 30s).

### Post-block (test 8)

When `blocked_action: true`, verification terminates in **`BLOCKED`** with zero score—preventing “verified” receipts for actions that never executed.

## Comparison operators

The diff engine supports: `EQUALS`, `NOT_EQUALS`, `GREATER_THAN`, `LESS_THAN`, `GREATER_OR_EQUAL`, `LESS_OR_EQUAL`, `IN`, `NOT_IN`, `CONTAINS`, `MATCHES`, `EXISTS`, `NOT_EXISTS`, with nested **`ALL`** / **`ANY`** groups.

## UAR v2 cryptographic proof standards

Outcome verification extends the five-dimensional trace (`who` / `can` / `why` / `did` / **outcome**) with:

| Field | Description |
|-------|-------------|
| `verification_status` | `VERIFIED` · `UNVERIFIED` · `FAILED` · `BLOCKED` |
| `verification_id` | Stable outcome verification run id |
| `evidence_ids` | Hash-chained evidence records |
| `outcome_diff` | Structured field-level diffs with severity |
| `verification_score` | 0–100 alignment score |
| `false_success_detected` | Boolean guardrail flag |

**Evidence chain rules:**

1. Observed state is hashed with **canonical JSON** (sorted keys; secrets redacted).  
2. Each `Evidence` record includes `integrity_hash` and `previous_hash` (tamper-evident chain).  
3. `GET /api/v1/outcome/{verification_id}/evidence` returns the chain + `integrity.hash_chain_valid`.

Full evaluate-path receipts: `POST /api/v1/action/evaluate` → `uar_v2_receipt.trace.outcome.*`  
Standalone verification: `POST /api/v1/outcome/verify` → `uar_v2_outcome` extension object.

Schema reference: [`UAR_SCHEMA.md`](./UAR_SCHEMA.md), `lib/nexus-core/schemas/uar-v2.ts`.

## Prometheus-style metrics (in-process)

Counters exported from `lib/nexus-core/outcome/metrics.ts`:

- `outcome_verification_total`
- `outcome_verified_total`
- `outcome_unverified_total`
- `outcome_failed_total`
- `outcome_blocked_total`
- `false_success_detected_total`
- `outcome_diff_critical_total`
- `evidence_chain_appended_total`

## A2B — Independent Agent Action Assurance Benchmark

Vertical assurance benchmark (Finance / ERP / CRM) in `lib/nexus-core/benchmark/`:

```bash
cd nexus-shield-dashboard
npm run test:benchmark   # 20 / 20 PASS
```

| Vertical | Scenarios | IDs |
|----------|-----------|-----|
| Finance | 8 | A2B-F01 … A2B-F08 |
| ERP | 7 | A2B-E01 … A2B-E07 |
| CRM | 5 | A2B-C01 … A2B-C05 |

**A2B metrics (fixed suite):** False Success Detection Rate **100%** · Outcome Verification Accuracy **100%**.

See [ASSURANCE_AND_UAR20.md](./ASSURANCE_AND_UAR20.md) for UAR 2.0 and Proof Center integration.

## Related documents

| Document | Topic |
|----------|--------|
| [BENCHMARK.md](../BENCHMARK.md) | Public benchmark index (nexus-core + A2B) |
| [ASSURANCE_AND_UAR20.md](./ASSURANCE_AND_UAR20.md) | Assurance Core, UAR 2.0, Proof Center |
| [BENCHMARK_VS_ACTION_FIREWALL.md](./BENCHMARK_VS_ACTION_FIREWALL.md) | Harness scores vs production UAR ledger |
| [security-benchmarks.md](./security-benchmarks.md) | MCP harness latency & transparency |
| [UAR_SCHEMA.md](./UAR_SCHEMA.md) | Canonical receipt fields |

---

*Nexus Shield — Business Action Assurance & Accountability Platform.*
