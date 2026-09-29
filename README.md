# Nexus Shield — AI Agent Action Governance & Verification Platform

> **Know what your agents are allowed to do. Stop what they shouldn't. Prove what actually happened.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](packages/vscode-extension/LICENSE)
[![Dashboard](https://img.shields.io/badge/Dashboard-LIVE-brightgreen)](https://nexus-shield-dashboard.vercel.app)
[![Governance](https://img.shields.io/badge/Platform-Action%20Governance%20%26%20Verification-0ea5e9)](docs/UAR_SCHEMA.md)
[![Data Plane](https://img.shields.io/badge/Data%20Plane-Air--Gap%20Ready-059669)](deployments/README.md)
[![UAR](https://img.shields.io/badge/UAR-SHA--256%20Verified-violet)](https://nexus-shield-dashboard.vercel.app/verify)
[![Compliance](https://img.shields.io/badge/SOC%202%20%7C%20ISO%2027001-Audit%20Ready-6366f1)](docs/COMPLIANCE_READINESS.md)
[![P99 6.1ms](https://img.shields.io/badge/P99%20intercept-6.1ms-22c55e)](https://nexus-shield-dashboard.vercel.app/investor)

**Live dashboard:** [nexus-shield-dashboard.vercel.app](https://nexus-shield-dashboard.vercel.app) · **Runtime API (optional):** [api.nexusshield.ai](https://api.nexusshield.ai/healthz) · **UAR verify:** [/verify](https://nexus-shield-dashboard.vercel.app/verify)

*Infrastructure promise:* **Your AI agents. Your infrastructure. Your data. Your policies.** — [Data plane vs control plane](./docs/DATA_PLANE_AND_CONTROL_PLANE.md)

---

## What Nexus Shield is (and is not)

**Your AI agent can call your APIs. Who verifies the action?**

Nexus Shield is an **AI Agent Action Governance & Verification Platform** — **not** a generic AI security checkbox or prompt-only LLM firewall. It governs **tool execution**, parameter hijacking, and intent divergence, and issues **Universal Action Receipts (UAR)** so you can prove what occurred.

> Nexus combines runtime action governance, trajectory-aware control, and verifiable cryptographic evidence into a single air-gapped deployment layer.

**Flow:** Interception (SEE) → Authority / Policy (CONTROL) → Execution → State Change → Cryptographic Proof (VERIFY).

Architecture: [ARCHITECTURE_WHITE_PAPER.md](./docs/ARCHITECTURE_WHITE_PAPER.md) · Action Receipt API: [ACTION_RECEIPT_API.md](./docs/ACTION_RECEIPT_API.md)

| We are | We are not |
|---|---|
| Action governance + cryptographic verification | A generic “AI security” checkbox |
| Runtime tool-call decisions + UAR ledger | A prompt-only firewall |
| Enterprise multi-tenant RBAC + SIEM-ready audits | Benchmark scores masquerading as production proof |

Upstream LLM inspection and PII engines are **supporting Security Engines** — the product object is the **UAR**.

---

## Universal Action Receipt (UAR) — core product object

Every governed **action attempt** at the runtime boundary produces a UAR — regardless of
`ALLOW`, `BLOCK`, `READ_ONLY`, or `REQUIRE_APPROVAL`. Canonical fields (see [UAR_SCHEMA.md](./docs/UAR_SCHEMA.md)):

| Field | Role |
|---|---|
| `receipt_id` | Unique receipt identifier |
| `agent_id` | Agent under governance |
| `intent` | Declared intent at decision time |
| `intent_divergence` | Risk / violations context (API envelope + audit) |
| `decision` | `ALLOW` · `BLOCK` · `READ_ONLY` · `REQUIRE_APPROVAL` |
| `execution_state` | Before/after state hashes |
| `evidence_hash` | SHA-256 over receipt core (`evidence_bundle_hash`) |

Evidence chain: **Intent → Action → Policy → Decision → Execution → State → UAR** — [`enterprise/evidence_chain.py`](./enterprise/evidence_chain.py)

---

## Proof Center — two transparent lanes

Do not mix benchmark marketing metrics with production proof. Public Proof Center counts such as
**tool calls analyzed** and **harness evidence bundles** include full trajectory evaluation
(ALLOW + BLOCK + other decisions) — they are **not** a count of blocked actions alone.

| Lane | Source | What it proves | Where |
|---|---|---|---|
| **Reproducible benchmark results** | `nexus-harness-benchmark` (`harness/`) | How frameworks *score* on fixed scenarios; one SHA-256 bundle per evaluated step | Leaderboards, GHCR harness, [/investor](https://nexus-shield-dashboard.vercel.app/investor) *benchmarks* |
| **Deterministic action evidence / UAR ledger** | Data plane runtime | What *your* agents attempted, what was decided, cryptographic seal per attempt | `enterprise/data/uar_receipts.jsonl`, [/verify](https://nexus-shield-dashboard.vercel.app/verify), Trust Hub |

Details: [BENCHMARK_VS_ACTION_FIREWALL.md](./docs/BENCHMARK_VS_ACTION_FIREWALL.md)

---

## Nexus Enterprise Ecosystem

| Component | Codename | Role |
|---|---|---|
| **Runtime** | **`nexus`** | Data plane — governance, UAR store ([`data_plane_api.py`](./enterprise/data_plane_api.py)) |
| **Control plane** | **`nexus-control`** | Optional Nexus Cloud — `CloudPanelService` ([`cloud_panel.py`](./enterprise/cloud_panel.py)) |
| **Python SDK** | **`nexus-agent-sdk-python`** | [`packages/python`](./packages/python) |
| **Bridge SDK** | **`nexus-agent-sdk-bridge`** | [`packages/npm`](./packages/npm) |
| **Evaluation** | **`nexus-harness-benchmark`** | Open scoring only — **not** the action firewall — [`harness/`](./harness/) |

```
                    ┌──────────── Optional nexus-control (Nexus Cloud) ────────────┐
                    │  license · signatures · opt-in telemetry                  │
                    └─────────────────────────┬──────────────────────────────────┘
                                              │ NEXUS_CLOUD_CONNECT=false default
┌─────────────────────────────────────────────▼────────────────────────────────────────────┐
│  DATA PLANE (nexus) — AI Agent Action Governance & Verification                          │
│  Policy engine · UAR ledger · SIEM/compliance JSONL · tenant RBAC                        │
└────────────────────────────────────────────────────────────────────────────────────────────┘
```

Deployment: [deployments/](./deployments/) · [DATA_PLANE_AND_CONTROL_PLANE.md](./docs/DATA_PLANE_AND_CONTROL_PLANE.md)

### 2-minute enterprise self-hosted trial

```bash
cd deployments/enterprise-demo
docker compose up
# mock LangChain-style agent → intercept → UAR logs on :8090
curl http://localhost:8090/healthz
```

See [deployments/enterprise-demo/README.md](./deployments/enterprise-demo/README.md). Inspect UAR JSON locally: `POST /api/v1/uar/inspect` (dashboard) or `python -c "from nexus_shield import inspect_action; print(inspect_action(...))"`.

### Air-gapped data plane (production-style)

```bash
cd deployments && NEXUS_AIRGAP=true NEXUS_CLOUD_CONNECT=false docker compose up -d
curl http://localhost:8090/healthz
```

---

## Enterprise modules

| Module | Purpose |
|---|---|
| [`tenant_manager.py`](./enterprise/tenant_manager.py) | Multi-tenant isolation, policy overrides, RBAC |
| [`cloud_panel.py`](./enterprise/cloud_panel.py) | Control plane orchestration, `process_agent_action` |
| [`uar_store.py`](./enterprise/uar_store.py) | Local UAR ledger |
| [`siem_exporter.py`](./enterprise/siem_exporter.py) | Splunk / Datadog / Elastic + SOC 2 / ISO audit records |

### RBAC

| Role | Capabilities |
|---|---|
| **Admin** | Tenants, SIEM configuration |
| **SecurityEngineer** | Policy overrides, interception, export |
| **Auditor** | Read-only audits and UAR verification |

---

## Quick start

```bash
# Control plane demo (UAR + RBAC + SIEM)
python -m enterprise.cloud_panel --demo

# Data plane HTTP API (returns UAR envelope)
NEXUS_DATA_PLANE_BOOTSTRAP=true uvicorn enterprise.data_plane_api:app --port 8090

# Harness benchmarks only (not production ledger)
docker run --rm ghcr.io/baturhantasdelen-sudo/harness:latest --eval-mcp
python scripts/simulate_vulnerability_preset.py --all --write-public-json
```

Public CVE demo: [/demo](https://nexus-shield-dashboard.vercel.app/demo) · [DETECT_AND_DEMONSTRATE_PROOF.md](./docs/DETECT_AND_DEMONSTRATE_PROOF.md)

---

## Runtime API (UAR-bearing)

**Dashboard:** `POST /api/v1/action/evaluate` · **Data plane:** `POST /v1/intercept` · Header: `x-api-key` (cloud) or bootstrap actor (on-prem)

Responses include **`universal_action_receipt`**, **`intent_divergence`** context, and **`evidence_hash`** / verify URL.

```bash
curl -X POST http://localhost:8090/v1/intercept \
  -H "Content-Type: application/json" \
  -d '{"user_intent":"read invoice","tool":"export_customer_database","params":{}}'
```

Verify: `GET /v1/receipts/{receipt_id}/verify` · Public: [/verify](https://nexus-shield-dashboard.vercel.app/verify)

Gateway (LLM path): [GATEWAY_INTEGRATION.md](./docs/GATEWAY_INTEGRATION.md)

---

## Documentation

| Document | Topic |
|---|---|
| [ARCHITECTURE_WHITE_PAPER.md](./docs/ARCHITECTURE_WHITE_PAPER.md) | Multi-repo hierarchy & Action Control Plane |
| [ACTION_RECEIPT_API.md](./docs/ACTION_RECEIPT_API.md) | Living UAR / Action Receipt standard |
| [ENTERPRISE_PITCH_AND_VISION.md](./docs/ENTERPRISE_PITCH_AND_VISION.md) | CISO / CTO pitch & architecture (PDF: `python scripts/generate_enterprise_deck.py --lang en`) |
| [ENTERPRISE_PITCH_AND_VISION_TR.md](./docs/ENTERPRISE_PITCH_AND_VISION_TR.md) | Turkish enterprise pitch (PDF: `python scripts/generate_enterprise_deck.py --lang tr`) |
| [UAR_SCHEMA.md](./docs/UAR_SCHEMA.md) | Canonical UAR fields |
| [DATA_PLANE_AND_CONTROL_PLANE.md](./docs/DATA_PLANE_AND_CONTROL_PLANE.md) | Air-gap, nexus vs nexus-control |
| [BENCHMARK_VS_ACTION_FIREWALL.md](./docs/BENCHMARK_VS_ACTION_FIREWALL.md) | Benchmark vs UAR ledger |
| [GATEWAY_INTEGRATION.md](./docs/GATEWAY_INTEGRATION.md) | Routers & upstream path |
| [COMPLIANCE_READINESS.md](./docs/COMPLIANCE_READINESS.md) | SOC 2 / ISO |
| [SECURITY.md](./SECURITY.md) | Privacy & OWASP |

---

## Project structure

| Path | Description |
|---|---|
| `enterprise/` | Governance runtime, UAR store, control plane |
| `harness/` | **nexus-harness-benchmark** (evaluation only) |
| `deployments/` | On-prem / air-gapped packaging |
| `nexus-shield-dashboard/` | Dashboard, Proof Center UI, `/verify` |
| `presets/` | Reproducible CVE-style scenarios |

---

## Tests & license

```bash
cd nexus-shield-dashboard && npm run test:all && npm run build
python -m enterprise.cloud_panel --demo
```

[MIT License](packages/vscode-extension/LICENSE) · [nexusshield.ai](https://nexusshield.ai) · [Book a demo](https://cal.com/baturhantasdelen/nexus-shield-demo)
