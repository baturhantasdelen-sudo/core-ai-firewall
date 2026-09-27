# Nexus Shield — Enterprise AI Action Governance

> **Your AI agents. Your infrastructure. Your data. Your policies.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](packages/vscode-extension/LICENSE)
[![Dashboard](https://img.shields.io/badge/Dashboard-LIVE-brightgreen)](https://nexus-shield-dashboard.vercel.app)
[![Data Plane](https://img.shields.io/badge/Data%20Plane-Air--Gap%20Ready-059669)](deployments/README.md)
[![UAR](https://img.shields.io/badge/UAR-SHA--256%20Verified-violet)](https://nexus-shield-dashboard.vercel.app/verify)
[![Compliance](https://img.shields.io/badge/SOC%202%20%7C%20ISO%2027001-Audit%20Ready-6366f1)](docs/COMPLIANCE_READINESS.md)
[![P99 6.1ms](https://img.shields.io/badge/P99%20intercept-6.1ms-22c55e)](https://nexus-shield-dashboard.vercel.app/investor)

**Live dashboard:** [nexus-shield-dashboard.vercel.app](https://nexus-shield-dashboard.vercel.app) · **Optional cloud guardrail:** [api.nexusshield.ai](https://api.nexusshield.ai/healthz) · **Public verify:** [/verify](https://nexus-shield-dashboard.vercel.app/verify)

---

## Overview

Nexus Shield is an **enterprise-grade upstream AI firewall** and **action governance** platform. It intercepts prompt injection, MCP tool hijacking, and exfiltration at the **LLM wire** and **tool execution boundary**, then seals decisions as **Universal Action Receipts (UAR)** with **SHA-256** evidence chains verifiable on `/verify` and in your **Proof Center**.

| Pillar | Description |
|---|---|
| **Upstream firewall** | Managed or self-hosted proxy — [GATEWAY_INTEGRATION.md](./docs/GATEWAY_INTEGRATION.md) |
| **Zero-day CVE harness** | Reproducible presets → deterministic UAR — [`presets/`](./presets/) |
| **Cryptographic proof** | Intent → Action → Policy → Decision → Execution → State → **UAR** — [`enterprise/evidence_chain.py`](./enterprise/evidence_chain.py) |
| **Enterprise isolation** | Multi-tenant RBAC, SIEM, compliance — [`enterprise/`](./enterprise/) |

---

## Nexus Enterprise Ecosystem

| Component | Codename | Role |
|---|---|---|
| **Runtime** | **`nexus`** | Data plane — policy engine, interception, local UAR store ([`data_plane_api.py`](./enterprise/data_plane_api.py)) |
| **Control plane** | **`nexus-control`** | Optional SaaS — `CloudPanelService` ([`cloud_panel.py`](./enterprise/cloud_panel.py)); license & signatures only when cloud-connected |
| **Python SDK** | **`nexus-agent-sdk-python`** | Client config / Security Engine — [`packages/python`](./packages/python) (`pip install nexus-shield`) |
| **Bridge SDK** | **`nexus-agent-sdk-bridge`** | Node / Vercel AI SDK bridge — [`packages/npm`](./packages/npm) |
| **Evaluation** | **`nexus-harness-benchmark`** | **Open scoring framework only** — not a production firewall — [`harness/`](./harness/) · [doc](./docs/BENCHMARK_VS_ACTION_FIREWALL.md) |

```
                    ┌──────────────── Optional Nexus Cloud ────────────────┐
                    │  nexus-control · telemetry · license · signatures   │
                    └─────────────────────────┬────────────────────────────┘
                                              │ NEXUS_CLOUD_CONNECT=false (default on-prem)
┌─────────────────────────────────────────────▼────────────────────────────────────────────┐
│  DATA PLANE (nexus) — fully self-hostable, air-gapped                                      │
│  CloudPanelService · policy_engine · LocalUarStore · SIEM JSONL · tenant registry        │
└────────────────────────────────────────────────────────────────────────────────────────────┘
         ▲                    ▲                         ▲
    Sidecar API          MCP / agent hook           LLM upstream proxy
```

---

## Deployment options

| Model | When to use | Start here |
|---|---|---|
| **Cloud** | Fastest proof, public `/demo` & dashboard | [Dashboard](https://nexus-shield-dashboard.vercel.app) |
| **Private cloud** | Your VPC, optional cloud control plane | [deployments/k8s](./deployments/k8s/nexus-shield/) |
| **On-prem / air-gapped** | No Nexus Cloud egress | [deployments/docker-compose.yml](./deployments/docker-compose.yml) |
| **Sidecar / API / MCP** | Co-locate `nexus-runtime` with agents | `POST /v1/intercept` on `:8090` |

Details: [DATA_PLANE_AND_CONTROL_PLANE.md](./docs/DATA_PLANE_AND_CONTROL_PLANE.md)

```bash
cd deployments
NEXUS_AIRGAP=true NEXUS_CLOUD_CONNECT=false docker compose up -d
curl http://localhost:8090/healthz
```

---

## Enterprise architecture

| Module | Capabilities |
|---|---|
| [`tenant_manager.py`](./enterprise/tenant_manager.py) | Multi-tenant isolation, `TenantPolicyOverrides`, RBAC (Admin, SecurityEngineer, Auditor) |
| [`siem_exporter.py`](./enterprise/siem_exporter.py) | Splunk HEC, Datadog, Elastic ECS + **SOC 2 / ISO 27001** audit records |
| [`cloud_panel.py`](./enterprise/cloud_panel.py) | Provisioning, `process_agent_action`, SIEM config, compliance audits |
| [`uar_store.py`](./enterprise/uar_store.py) | Local receipt index — **no cloud required** |
| [`evidence_chain.py`](./enterprise/evidence_chain.py) | UAR hash verify + stage timeline for auditors |

### RBAC (control plane)

| Role | Capabilities |
|---|---|
| **Admin** | Tenant + SIEM endpoint configuration |
| **SecurityEngineer** | Policy overrides, interception, SIEM export |
| **Auditor** | Read-only audits and UAR verification |

### Proof Center / receipt verification

```bash
# Self-hosted data plane
curl "http://localhost:8090/v1/receipts/{receipt_id}/verify?evidence_bundle_hash={sha256}"

# CloudPanelService (Python)
python -c "from enterprise.cloud_panel import CloudPanelService; ..."
```

Stored receipts: `enterprise/data/uar_receipts.jsonl` · Public parameter check: [/verify](https://nexus-shield-dashboard.vercel.app/verify)

---

## Quick start & demos

### Enterprise control plane

```bash
python -m enterprise.cloud_panel --demo
python -m enterprise.tenant_manager --demo
python -m enterprise.siem_exporter --demo --dispatch-mock
```

### Data plane API (local)

```bash
NEXUS_DATA_PLANE_BOOTSTRAP=true uvicorn enterprise.data_plane_api:app --port 8090
curl -X POST http://localhost:8090/v1/intercept \
  -H "Content-Type: application/json" \
  -d '{"user_intent":"read invoice","tool":"export_customer_database","params":{"destination":"https://webhook.site/x"}}'
```

### Benchmark & CVE presets (evaluation only)

```bash
python scripts/simulate_vulnerability_preset.py --preset cve-2026-critical-zero-day
python scripts/simulate_vulnerability_preset.py --all --write-public-json
docker run --rm ghcr.io/baturhantasdelen-sudo/harness:latest --eval-mcp
```

Live UI: [/demo](https://nexus-shield-dashboard.vercel.app/demo) · Doc: [DETECT_AND_DEMONSTRATE_PROOF.md](./docs/DETECT_AND_DEMONSTRATE_PROOF.md)

---

## Live platform (optional cloud UX)

| Route | Capability |
|---|---|
| [/demo](https://nexus-shield-dashboard.vercel.app/demo) | CVE presets + UAR + `/verify` |
| [/verify](https://nexus-shield-dashboard.vercel.app/verify) | Independent receipt check |
| [/proof-center](https://nexus-shield-dashboard.vercel.app/proof-center) | Evidence ledger |
| [/scan](https://nexus-shield-dashboard.vercel.app/scan) | Agent & MCP scanner |
| [/docs](https://nexus-shield-dashboard.vercel.app/docs) | Runtime API reference |

---

## API reference (runtime)

**Dashboard:** `https://nexus-shield-dashboard.vercel.app` · Header: `x-api-key: nex_...`

```bash
curl -X POST https://nexus-shield-dashboard.vercel.app/api/v1/action/evaluate \
  -H "x-api-key: nex_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"agent_id":"agent-1","user_intent":"Invoice #4421","tool_call":{"name":"read_invoice","args":{}},"agent_capabilities":["READ"]}'
```

| Status | Decision |
|---|---|
| `200` | `ALLOW` |
| `202` | `HUMAN_APPROVAL_REQUIRED` |
| `403` | `BLOCK` + UAR metadata |

---

## Documentation index

| Document | Topic |
|---|---|
| [DATA_PLANE_AND_CONTROL_PLANE.md](./docs/DATA_PLANE_AND_CONTROL_PLANE.md) | Air-gap, `nexus` vs `nexus-control` |
| [BENCHMARK_VS_ACTION_FIREWALL.md](./docs/BENCHMARK_VS_ACTION_FIREWALL.md) | Harness vs production firewall |
| [GATEWAY_INTEGRATION.md](./docs/GATEWAY_INTEGRATION.md) | Portkey, LangChain, LiteLLM |
| [DETECT_AND_DEMONSTRATE_PROOF.md](./docs/DETECT_AND_DEMONSTRATE_PROOF.md) | CISO verification playbook |
| [COMPLIANCE_READINESS.md](./docs/COMPLIANCE_READINESS.md) | SOC 2 / ISO automation |
| [SECURITY.md](./SECURITY.md) | On-device privacy, OWASP |
| [deployments/README.md](./deployments/README.md) | Compose & Helm |

---

## Project structure

| Path | Description |
|---|---|
| `deployments/` | Docker Compose + Helm (data plane) |
| `enterprise/` | Control plane services, UAR store, SIEM |
| `harness/` | **nexus-harness-benchmark** (evaluation) |
| `presets/` | CVE / PoC preset database |
| `nexus-shield-dashboard/` | Cloud dashboard & public proof UX |
| `packages/python`, `packages/npm`, `packages/cli` | SDKs & local LLM proxy |

---

## Tests

```bash
cd nexus-shield-dashboard && npm run test:all && npm run build
python -m enterprise.cloud_panel --demo
```

---

## Contact & license

[MIT License](packages/vscode-extension/LICENSE) · Enterprise licensing: [nexusshield.ai](https://nexusshield.ai) · [Book a demo](https://cal.com/baturhantasdelen/nexus-shield-demo)
