# Nexus Shield — Business Action Assurance & Accountability Platform

![A2B Benchmark](https://img.shields.io/badge/A2B-20%2F20%20PASS-success)
![Outcome Verification](https://img.shields.io/badge/nexus--core-24%2F24%20PASS-success)
![UAR 2.0](https://img.shields.io/badge/UAR%202.0-Ed25519%20%2B%20SHA--256-violet)

> **DO NOT TRUST THE AGENT. DO NOT TRUST THE TOOL RESPONSE. VERIFY THE WORLD.**

Nexus Shield is a **Business Action Assurance & Accountability Platform**. Agents invoke tools; tools return HTTP success. **Neither is ground truth.** The **Assurance Core** maps each business claim to an **authoritative vertical** (payment provider, ledger, ERP, CRM, IAM), verifies **expected vs. actual** state, detects **false success, ghost actions, and side effects**, and seals **UAR 2.0** receipts that separate **what happened** (action) from **was it verified** (multi-source proof).

**Flow:** SEE → CONTROL → **ASSURE (authoritative verification)** → PROVE (UAR 2.0 + Proof Center export).

| Step | What you do | Resources |
|------|-------------|-----------|
| **1. Evaluate actions** | `POST /api/v1/action/evaluate` — seven-engine pipeline + outcome merge | [`nexus-shield-dashboard/`](nexus-shield-dashboard/) |
| **2. Verify outcomes** | `POST /api/v1/outcome/verify` — expected state vs. adapter read | [Benchmark 2027](docs/benchmark-2027.md) |
| **3. Proof Center** | `GET /api/v1/proof/{transaction_id}` — per-claim evidence + integrity | [Assurance & UAR 2.0](docs/ASSURANCE_AND_UAR20.md) |
| **4. Offline verify** | `npm run nexus-proof -- proof.json` | Public key in `lib/nexus-core/uar/keys.ts` |

Optional **Security Engines** (PII / prompt inspection) may sit upstream; they are **not** the product. The product is **verified consequential action** and **accountability receipts**.

```bash
cd nexus-shield-dashboard
npm run test:nexus-core   # 24/24 — pipeline + outcome scenarios
npm run test:benchmark    # 20/20 — A2B finance/erp/crm assurance
npm run build
```

## Nexus Agent Action Verification Benchmark 2027

Reproducible gate for the Outcome Verification Engine. Full report: **[docs/benchmark-2027.md](docs/benchmark-2027.md)** · Summary: **[BENCHMARK.md](BENCHMARK.md)**

| Category | Coverage | Status |
|----------|----------|--------|
| **FINANCIAL** | Ledger posting, amount integrity, refunds | PASS |
| **ERP** | SAP-style outcome adapters | PASS |
| **CRM** | Salesforce / HubSpot read paths | PASS |
| **DATABASE** | Read-only SELECT + query fingerprint | PASS |
| **IAM** | AWS IAM / effective authority | PASS |
| **DESTRUCTIVE** | Delete / purge consequential checks | PASS |
| **MULTI-AGENT** | Delegation, trust isolation, containment | PASS |
| **HTTP / API** | Tool response vs. observed state | PASS |
| **SIDE-EFFECT** | Constraint violations (`NOT_EXISTS`, etc.) | PASS |
| **TEMPORAL / SLA** | Pending / eventual consistency | PASS |
| **POST-BLOCK** | Blocked actions never “verified” | PASS |

**Combined `test:nexus-core`:** **24 / 24 PASS** · **A2B (`test:benchmark`):** **20 / 20 PASS** · False success detection **100%** · DoD **42 / 42**

### A2B — Independent Agent Action Assurance Benchmark

Open fixtures in `lib/nexus-core/benchmark/a2b-scenarios.ts` — **8 Finance**, **7 ERP**, **5 CRM** vertical scenarios. Metrics: **False Success Detection Rate 100%**, **Outcome Verification Accuracy 100%** on the fixed suite.

## Proof Center API

Per-transaction evidence viewer (populated when `POST /api/v1/action/evaluate` runs — UAR 2.0 is persisted by transaction id):

```bash
curl http://localhost:3000/api/v1/proof/TXN-8842 \
  -H "x-nexus-api-key: nex_YOUR_KEY"
```

Export signed bundle for auditors:

```bash
curl http://localhost:3000/api/v1/proof/TXN-8842/export \
  -H "x-nexus-api-key: nex_YOUR_KEY"
```

Returns `proof.json` payload + manifest with `signature_valid`, `chain_valid`, and `authority_valid` checks.

## Assurance architecture (code map)

| Module | Path |
|--------|------|
| Authoritative sources & rules | `lib/nexus-core/assurance/` |
| Finance / ERP / CRM adapters | `lib/nexus-core/adapters/vertical/` |
| UAR 2.0 vendor-neutral receipt | `lib/nexus-core/uar/` |
| Proof assembly & store | `lib/nexus-core/proof/` |
| A2B benchmark | `lib/nexus-core/benchmark/` |
| Legacy outcome engine (compatible) | `lib/nexus-core/outcome/` |

## Outcome verification API

Validate **expected world state** after an agent action. Requires `x-nexus-api-key` or `x-api-key` (same as evaluate).

```bash
curl -X POST http://localhost:3000/api/v1/outcome/verify \
  -H "Content-Type: application/json" \
  -H "x-nexus-api-key: nex_YOUR_KEY" \
  -d '{
    "agent_id": "finance-agent-01",
    "action_id": "pay-invoice-8842",
    "expected_outcome": {
      "outcome_id": "out_pay_8842",
      "action_id": "pay-invoice-8842",
      "type": "ledger_posting",
      "expected_state": {
        "status": "POSTED",
        "amount": 50000,
        "ledger_entry": true
      }
    },
    "adapter_id": "mock",
    "mock_fixture": "exact_match",
    "tool_response": {
      "status_code": 200,
      "body": "{\"success\":true}"
    },
    "resource_id": "TXN-8842"
  }'
```

**Example response (truncated):**

```json
{
  "verification_status": "VERIFIED",
  "evidence_ids": ["ev_…"],
  "outcome_diff": [],
  "uar_v2_outcome": {
    "verification_status": "VERIFIED",
    "verification_id": "ov_…",
    "evidence_ids": ["ev_…"],
    "outcome_diff": [],
    "score": 100,
    "false_success_detected": false
  },
  "verification": {
    "score": 100,
    "integrity": { "hash_chain_valid": true, "evidence_count": 1 }
  }
}
```

If the tool reports success but the adapter sees `PENDING` or no ledger row, status is **`UNVERIFIED`** with `false_success_detected: true` — never promoted to VERIFIED based on HTTP alone.

**Related endpoints**

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/v1/outcome/verify` | Run verification |
| `GET` | `/api/v1/outcome/{verification_id}` | Fetch result + diffs |
| `GET` | `/api/v1/outcome/{verification_id}/evidence` | Hash-chained evidence |
| `POST` | `/api/v1/action/evaluate` | Full pipeline + `uar_v2_receipt` + `uar20` |
| `GET` | `/api/v1/proof/{transaction_id}` | Claim-level evidence viewer |
| `GET` | `/api/v1/proof/{transaction_id}/export` | Signed `proof.json` + manifest |

Implementation: `lib/nexus-core/assurance/`, `outcome/`, `uar/`, `proof/`

---

## Deployment paths

| Audience | Path | Doc |
|----------|------|-----|
| **Developers** | `pip install -e .` → `nexus-shield reference up` | [Quick Start (CLI / Compose)](docs/QUICKSTART_DEVELOPER.md) |
| **Enterprise K8s** | `helm install` + Vault/K8s Secrets | [Helm & air-gapped K8s](docs/ENTERPRISE_HELM_DEPLOY.md) |
| **Single VM (GCP)** | Docker Compose prod | [DEPLOYMENT.md](DEPLOYMENT.md) |
| **Trust & security review** | Air-gap, deployment paths, CISO signals | [Trust Center (docs)](docs/TRUST_CENTER_ENTERPRISE.md) |

```bash
pip install -e .
nexus-shield reference up --build -d    # :8090 reference sidecar
nexus-shield uar verify examples/sample-receipt.json
```

## Try it in 30 seconds (local)

```bash
git clone https://github.com/baturhantasdelen-sudo/core-ai-firewall.git && cd core-ai-firewall
cd nexus-shield-dashboard && npm run dev   # :3000
```

Seven-engine evaluate + UAR v2:

```bash
curl -X POST http://localhost:3000/api/v1/action/evaluate \
  -H "Content-Type: application/json" \
  -H "x-nexus-api-key: nex_YOUR_KEY" \
  -d '{"agent_id":"demo","user_intent":"Pay invoice","tool_call":{"name":"execute_payment","args":{}}}'
```

Proof Center: `/proof-center` · Inspect UAR: `POST /api/v1/uar/inspect`

### GitHub Action — verify agent tool calls in CI

```yaml
name: Agent governance
on: [workflow_dispatch]

jobs:
  verify-agent-action:
    runs-on: ubuntu-latest
    steps:
      - uses: nexus-shield/action-verify@v1
        id: nexus
        with:
          agent_intent: "Export production database"
          tool_call_payload: '{"name": "export_db", "args": {"db": "prod"}}'
          policy_endpoint: http://localhost:8090
      - run: echo "${{ steps.nexus.outputs.uar_receipt_id }} — ${{ steps.nexus.outputs.verification_status }}"
```

Same action from this repository: `uses: baturhantasdelen-sudo/core-ai-firewall@v1`.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](packages/vscode-extension/LICENSE)
[![GitHub](https://img.shields.io/badge/GitHub-core--ai--firewall-181717)](https://github.com/baturhantasdelen-sudo/core-ai-firewall)
[![Governance](https://img.shields.io/badge/Platform-Action%20Verification%20%26%20Accountability-0ea5e9)](docs/benchmark-2027.md)
[![UAR](https://img.shields.io/badge/UAR-Tamper--evident%20SHA--256-violet)](docs/UAR_SCHEMA.md)

**Source:** [github.com/baturhantasdelen-sudo/core-ai-firewall](https://github.com/baturhantasdelen-sudo/core-ai-firewall) · **Dashboard:** [`nexus-shield-dashboard/`](nexus-shield-dashboard/) · **Harness (MCP scoring):** [`harness/`](harness/)

*Infrastructure promise:* **Your AI agents. Your infrastructure. Your data. Your policies.** — [Data plane vs control plane](./docs/DATA_PLANE_AND_CONTROL_PLANE.md)

---

## What Nexus Shield is (and is not)

**Your agent called the API. Did the business world actually change?**

| We are | We are not |
|--------|------------|
| Outcome verification against systems of record | Trusting tool HTTP 200 as proof |
| UAR v2 accountability (who / can / why / did / **outcome**) | A prompt-only “AI firewall” product |
| False success & ghost-action detection | Benchmark scores without world-state checks |
| Policy, authority, containment, evidence | Generic LLM security checkbox |

Architecture: [ARCHITECTURE_WHITE_PAPER.md](./docs/ARCHITECTURE_WHITE_PAPER.md) · Outcome engine: [docs/benchmark-2027.md](./docs/benchmark-2027.md)

---

## Universal Action Receipt (UAR) v2 — proof object

Every governed action produces a tamper-evident receipt. Outcome verification adds **`verification_status`**, **`evidence_ids`**, **`outcome_diff`**, and **`false_success_detected`** on the trace. See [UAR_SCHEMA.md](./docs/UAR_SCHEMA.md).

| Field | Role |
|-------|------|
| `receipt_id` | Unique receipt identifier |
| `trace.outcome` | Verification status, adapter, diffs, evidence ids |
| `cryptographic_anchor` | Action proof + evidence hash binding |

---

## Proof Center — two lanes

| Lane | Source | What it proves |
|------|--------|----------------|
| **Outcome Verification Benchmark 2027** | `npm run test:nexus-core` | 12 outcome scenarios, 24/24 PASS |
| **A2B Assurance Benchmark** | `npm run test:benchmark` | 20 vertical scenarios, 20/20 PASS |
| **MCP harness** | `harness/` | Framework scoring on fixed attack scenarios |

Do not confuse harness leaderboard scores with production outcome verification. See [BENCHMARK_VS_ACTION_FIREWALL.md](./docs/BENCHMARK_VS_ACTION_FIREWALL.md).

---

## Nexus ecosystem

| Component | Role |
|-----------|------|
| **`nexus-shield-dashboard`** | Evaluate API, Outcome Verification API, Proof Center UI |
| **`nexus` / `enterprise/`** | Data plane, UAR store, SIEM export |
| **`nexus-harness-benchmark`** | Open MCP evaluation (separate from outcome engine) |
| **SDKs** | [`packages/python`](./packages/python), [`packages/npm`](./packages/npm) |

---

## Runtime APIs (summary)

| API | Role |
|-----|------|
| `POST /api/v1/action/evaluate` | Seven-engine pipeline + `uar_v2_receipt` |
| `POST /api/v1/outcome/verify` | Standalone expected vs. actual verification |
| `POST /v1/intercept` | Data plane intercept (`:8090`) |

Data plane example:

```bash
curl -X POST http://localhost:8090/v1/intercept \
  -H "Content-Type: application/json" \
  -d '{"user_intent":"read invoice","tool":"export_customer_database","params":{}}'
```

Gateway (optional LLM path): [GATEWAY_INTEGRATION.md](./docs/GATEWAY_INTEGRATION.md)

---

## Documentation

| Document | Topic |
|----------|--------|
| **[ASSURANCE_AND_UAR20.md](./docs/ASSURANCE_AND_UAR20.md)** | Assurance Core, UAR 2.0, Proof Center, A2B |
| **[benchmark-2027.md](./docs/benchmark-2027.md)** | Outcome Verification Benchmark — 12 scenarios, metrics |
| **[BENCHMARK.md](./BENCHMARK.md)** | Benchmark index |
| [UAR_SCHEMA.md](./docs/UAR_SCHEMA.md) | Canonical UAR fields |
| [ACTION_RECEIPT_API.md](./docs/ACTION_RECEIPT_API.md) | Action Receipt standard |
| [ARCHITECTURE_WHITE_PAPER.md](./docs/ARCHITECTURE_WHITE_PAPER.md) | Control plane architecture |
| [QUICKSTART_DEVELOPER.md](./docs/QUICKSTART_DEVELOPER.md) | SDK & intercept quick start |
| [TRUST_CENTER_ENTERPRISE.md](./docs/TRUST_CENTER_ENTERPRISE.md) | Enterprise trust |
| [BENCHMARK_VS_ACTION_FIREWALL.md](./docs/BENCHMARK_VS_ACTION_FIREWALL.md) | Harness vs UAR ledger |
| [security-benchmarks.md](./docs/security-benchmarks.md) | MCP harness transparency |
| [COMPLIANCE_READINESS.md](./docs/COMPLIANCE_READINESS.md) | SOC 2 / ISO |
| [SECURITY.md](./SECURITY.md) | Privacy & OWASP |

---

## Project structure

| Path | Description |
|------|-------------|
| `nexus-shield-dashboard/lib/nexus-core/assurance/` | Assurance Core (sources, rules, side-effects) |
| `nexus-shield-dashboard/lib/nexus-core/adapters/vertical/` | Finance / ERP / CRM read adapters |
| `nexus-shield-dashboard/lib/nexus-core/uar/` | UAR 2.0 receipt + offline verify |
| `nexus-shield-dashboard/lib/nexus-core/proof/` | Proof Center bundles |
| `nexus-shield-dashboard/lib/nexus-core/benchmark/` | A2B scenarios + runner |
| `nexus-shield-dashboard/lib/nexus-core/outcome/` | Outcome Verification Engine (legacy-compatible) |
| `nexus-shield-dashboard/app/api/v1/outcome/` | Outcome verify REST API |
| `nexus-shield-dashboard/app/api/v1/proof/` | Proof Center REST API |
| `enterprise/` | Governance runtime, UAR store |
| `harness/` | MCP benchmark harness (evaluation only) |
| `deployments/` | On-prem / air-gapped packaging |

---

## Tests

```bash
cd nexus-shield-dashboard && npm run test:nexus-core && npm run test:benchmark && npm run build
python -m enterprise.cloud_panel --demo
```

[MIT License](packages/vscode-extension/LICENSE) · [nexusshield.ai](https://nexusshield.ai)
