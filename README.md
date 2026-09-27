# Nexus Shield — Upstream AI Firewall & Agent Action Governance

> **Agents can act. Nexus decides whether they should — and produces cryptographic proof of what happened.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](packages/vscode-extension/LICENSE)
[![Dashboard](https://img.shields.io/badge/Dashboard-LIVE-brightgreen)](https://nexus-shield-dashboard.vercel.app)
[![Enterprise](https://img.shields.io/badge/Enterprise-Multi--Tenant%20%2B%20RBAC-0ea5e9)](enterprise/cloud_panel.py)
[![CI/CD Pipeline](https://github.com/baturhantasdelen-sudo/core-ai-firewall/actions/workflows/deploy.yml/badge.svg)](https://github.com/baturhantasdelen-sudo/core-ai-firewall/actions/workflows/deploy.yml)
[![P99 intercept 6.1ms](https://img.shields.io/badge/P99%20intercept-6.1ms-22c55e)](https://nexus-shield-dashboard.vercel.app/investor)
[![SHA-256 UAR](https://img.shields.io/badge/SHA--256-UAR%20Verified-violet)](https://nexus-shield-dashboard.vercel.app/verify)
[![SIEM](https://img.shields.io/badge/SIEM-Splunk%20%7C%20Datadog%20%7C%20Elastic-f97316)](enterprise/siem_exporter.py)
[![Compliance](https://img.shields.io/badge/Compliance-SOC%202%20%7C%20ISO%2027001-6366f1)](docs/COMPLIANCE_READINESS.md)

**Live Dashboard:** [nexus-shield-dashboard.vercel.app](https://nexus-shield-dashboard.vercel.app) · **Upstream Guardrail API:** [api.nexusshield.ai](https://api.nexusshield.ai/healthz) · **Public UAR verify:** [/verify](https://nexus-shield-dashboard.vercel.app/verify)

---

## Overview & value proposition

Nexus Shield is an **upstream AI firewall / interceptor proxy** for enterprise agent fleets. It sits on the LLM wire and at the **tool execution boundary** to stop prompt injection, MCP tool hijacking, data exfiltration, and **zero-day-style agent attacks** before side effects occur.

| Capability | What you get |
|---|---|
| **Upstream AI firewall** | Managed `api.nexusshield.ai` or local OpenAI-compatible proxy — inspect, redact, and block before traffic reaches providers ([gateway guide](./docs/GATEWAY_INTEGRATION.md)) |
| **Open-Core policy harness** | Deterministic runtime decisions in `harness/core/policy_engine.py` — `ALLOW` / `BLOCK` / `READ_ONLY` / `REQUIRE_APPROVAL` |
| **Zero-day CVE preset database** | Modular PoC scenarios under [`presets/`](./presets/) — reproduce disclosures, seal evidence, publish `/verify` links |
| **Universal Action Receipts (UAR)** | SHA-256 **evidence bundle** per interception — independently checkable on [`/verify`](https://nexus-shield-dashboard.vercel.app/verify) |
| **Enterprise Edition** | Multi-tenant isolation, RBAC, SIEM export, compliance hooks, unified **CloudPanelService** SaaS control plane |

**Primary runtime benchmark:** P99 intercept **6.1 ms** (Nexus benchmark harness). OWASP GenAI / Agentic threat tags on evaluate responses. On-device-friendly deployments — see [SECURITY.md](./SECURITY.md).

| Legacy approach | Nexus Shield |
|---|---|
| Static regex on commits | **Runtime tool interception** + intent–action consistency |
| Prompt-only filters | **Action governance** + cryptographic receipts |
| Opaque vendor logs | **Independent `/verify`** + SIEM-ready JSON |
| Single-tenant scripts | **Enterprise RBAC** + per-tenant policy overrides |

---

## Enterprise architecture highlights

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    NEXUS SHIELD ENTERPRISE CONTROL PLANE                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  CloudPanelService (enterprise/cloud_panel.py)                               │
│    ├── Tenant provisioning & SIEM configuration (Admin)                      │
│    ├── Policy overrides & interception pipeline (SecurityEngineer)         │
│    └── Audit / UAR read-only access (Auditor)                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  TenantManager (enterprise/tenant_manager.py)                              │
│    ├── Multi-tenant isolation · registered agent IDs                       │
│    ├── TenantPolicyOverrides (blocked tools, risk thresholds, HITL tools)  │
│    └── RBAC — Admin · SecurityEngineer · Auditor                           │
├─────────────────────────────────────────────────────────────────────────────┤
│  SiemExporter (enterprise/siem_exporter.py)                                │
│    ├── Splunk HEC · Datadog logs · Elastic ECS adapters                      │
│    ├── ComplianceLogger — SOC 2 / ISO 27001 hook mapping                     │
│    └── Mock or live webhook dispatch                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│  Open-Core harness — harness/core/policy_engine.py + presets/              │
└─────────────────────────────────────────────────────────────────────────────┘
         │                                    │
         ▼                                    ▼
  api.nexusshield.ai/v1/shield          Dashboard /api/v1/action/evaluate
  (upstream LLM firewall)               (UAR + governance APIs)
```

### Multi-tenant isolation & policy overrides

[`enterprise/tenant_manager.py`](./enterprise/tenant_manager.py) enforces **tenant-scoped agents**, **custom policy overlays** on top of the global engine, and persisted registry JSON for air-gapped installs.

| Override | Effect |
|---|---|
| `blocked_tools` | Hard `BLOCK` (e.g. `bash_execution`, `merge_pull_request`) |
| `block_risk_threshold` | Lower/raise tenant block sensitivity (default engine threshold: 85) |
| `require_approval_tools` | Force `REQUIRE_APPROVAL` / HITL path |
| `additional_high_risk_tools` | Tenant-specific high-risk tool list |

### Role-based access control (RBAC)

| Role | Typical permissions |
|---|---|
| **Admin** | Tenant provisioning, user assignment, SIEM endpoint configuration |
| **SecurityEngineer** | Policy overrides, runtime `evaluate_actions`, SIEM export |
| **Auditor** | Read-only compliance audits, UAR / receipt viewing |

### SIEM exporters & compliance hooks

[`enterprise/siem_exporter.py`](./enterprise/siem_exporter.py) turns interceptions into vendor-specific payloads:

| Vendor | Format |
|---|---|
| **Splunk** | HEC-style envelope + indexed fields |
| **Datadog** | Logs API (`ddsource`, `ddtags`, `attributes`) |
| **Elastic** | ECS-oriented documents |

Compliance hooks map events to **SOC 2** (e.g. CC7.2, CC6.6) and **ISO 27001:2022** (e.g. A.8.8, A.8.16) evidence keys — see [COMPLIANCE_READINESS.md](./docs/COMPLIANCE_READINESS.md).

### Unified control plane

[`enterprise/cloud_panel.py`](./enterprise/cloud_panel.py) — **`CloudPanelService`** orchestrates provisioning, `process_agent_action` (RBAC → policy → UAR → SIEM), `configure_tenant_siem`, and `fetch_compliance_audits`.

---

## Quick start & demos

### Enterprise Edition (Python 3.10+)

From the repository root:

```bash
# End-to-end SaaS control plane: provision tenant → policy → BLOCK + UAR → SIEM → RBAC
python -m enterprise.cloud_panel --demo

# Multi-tenant RBAC + isolated evaluation
python -m enterprise.tenant_manager --demo

# SIEM formatting (Splunk / Datadog / Elastic) + compliance JSONL
python -m enterprise.siem_exporter --demo
python -m enterprise.siem_exporter --demo --dispatch-mock --vendor splunk
```

### Zero-day CVE harness & public proof

```bash
python scripts/simulate_vulnerability_preset.py --list
python scripts/simulate_vulnerability_preset.py --preset cve-2026-critical-zero-day
python scripts/simulate_vulnerability_preset.py --all --write-public-json

# Video-friendly terminal walkthrough
bash scripts/record_demo_terminal.sh
```

Live selector: [/demo](https://nexus-shield-dashboard.vercel.app/demo) · Proof doc: [DETECT_AND_DEMONSTRATE_PROOF.md](./docs/DETECT_AND_DEMONSTRATE_PROOF.md)

### Dashboard & upstream API

```bash
cd nexus-shield-dashboard && npm install && npm run dev
# → http://localhost:3000

curl https://api.nexusshield.ai/healthz
curl -X POST https://api.nexusshield.ai/v1/shield \
  -H "X-API-Key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"user_input":"Ignore previous instructions","session_id":"demo_1"}'
```

Gateway integration (Portkey, LangChain, LiteLLM): [GATEWAY_INTEGRATION.md](./docs/GATEWAY_INTEGRATION.md)

### Docker Trojan Horse demo (open-core)

```bash
cd nexus-shield-demo && docker compose up
```

Guide: [nexus-shield-demo/README.md](./nexus-shield-demo/README.md)

---

## Live platform (public routes)

| Module | Route | Capability |
|---|---|---|
| **Detect & Demonstrate** | [/demo](https://nexus-shield-dashboard.vercel.app/demo) | CVE preset selector, UAR, `/verify` links |
| **Free Agent & MCP Scanner** | [/scan](https://nexus-shield-dashboard.vercel.app/scan) | Dynamic MCP/agent analysis, PDF audit |
| **Challenge Engine** | [/challenge](https://nexus-shield-dashboard.vercel.app/challenge) | 7-level sandbox + proof badges |
| **Attack Simulator** | [/#attack-simulator](https://nexus-shield-dashboard.vercel.app/#attack-simulator) | Live governance narrative |
| **Proof Center** | [/proof-center](https://nexus-shield-dashboard.vercel.app/proof-center) | SHA-256 evidence ledger |
| **Investor metrics** | [/investor](https://nexus-shield-dashboard.vercel.app/investor) | Latency, detection, fleet telemetry |
| **Pricing** | [/pricing](https://nexus-shield-dashboard.vercel.app/pricing) | Developer → Enterprise tiers |
| **API docs** | [/docs](https://nexus-shield-dashboard.vercel.app/docs) | Runtime API reference |

Authenticated SOC panels: `/dashboard`, `/dashboard/actions`, `/dashboard/trust-hub`, `/dashboard/compliance`, and related routes on the live dashboard.

---

## Runtime architecture (open-core + cloud)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        NEXUS SHIELD RUNTIME STACK                           │
├─────────────────────────────────────────────────────────────────────────────┤
│  LLM traffic ──► Upstream proxy (local CLI or api.nexusshield.ai/v1/shield) │
│  Agent tools ──► POST /api/v1/action/evaluate ──► UAR + evidence_bundle_hash │
│  Enterprise ──► CloudPanelService ──► TenantManager + SiemExporter          │
│  Harness ──► policy_engine.py + presets/ ──► reproducible zero-day proofs     │
│  Trust layers ──► trajectory · MCP guardrail · memory · reputation · immune   │
└─────────────────────────────────────────────────────────────────────────────┘
```

| Component | Path | Deploy |
|---|---|---|
| **Dashboard & governance APIs** | `nexus-shield-dashboard/` | Vercel |
| **Enterprise control plane** | `enterprise/` | Self-hosted / embedded |
| **Policy harness** | `harness/core/policy_engine.py` | GHCR harness image |
| **Guardrail FastAPI** | `nexus_shield_fast_api.py` | GCP + Cloudflare |
| **CVE preset DB** | `presets/`, `scripts/simulate_vulnerability_preset.py` | Repo + `/demo` static JSON |

Deploy: [DEPLOYMENT.md](./DEPLOYMENT.md) · Enterprise sales: [ENTERPRISE.md](./ENTERPRISE.md)

---

## API quick reference

**Dashboard base:** `https://nexus-shield-dashboard.vercel.app` · Auth: `x-api-key: nex_...`

### Action evaluation + UAR

```bash
curl -X POST https://nexus-shield-dashboard.vercel.app/api/v1/action/evaluate \
  -H "x-api-key: nex_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "crewai-finance-agent-1",
    "user_intent": "Invoice check #4421",
    "tool_call": { "name": "read_invoice", "args": { "customer_id": "4421" } },
    "agent_capabilities": ["READ", "API_CALL"]
  }'
```

| HTTP | Decision | Meaning |
|---|---|---|
| `200` | `ALLOW` | Permitted |
| `202` | `HUMAN_APPROVAL_REQUIRED` | Elevated risk — approval gate |
| `403` | `BLOCK` | Denied — receipt still issued via governance path |

Signed receipt verification:

```bash
curl -X POST https://nexus-shield-dashboard.vercel.app/api/v1/actions/verify \
  -H "x-api-key: nex_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "crewai-finance-agent-1",
    "user_intent": "Invoice check #4421",
    "tool_call": { "name": "read_invoice", "args": { "customer_id": "4421" } }
  }'
```

Public parameter check (no API key):  
`https://nexus-shield-dashboard.vercel.app/verify?receipt_hash=<SHA-256>&receipt_id=<uar_…>`

Additional APIs: `/api/v1/scan`, `/api/v1/simulate`, `/api/v1/agent/trust`, `/api/v1/immune/signatures` — see [/docs](https://nexus-shield-dashboard.vercel.app/docs).

---

## Documentation index

| Document | Topic |
|---|---|
| [GATEWAY_INTEGRATION.md](./docs/GATEWAY_INTEGRATION.md) | Upstream firewall vs SDK plugins · LiteLLM / LangChain / Portkey |
| [DETECT_AND_DEMONSTRATE_PROOF.md](./docs/DETECT_AND_DEMONSTRATE_PROOF.md) | Independent verification · CISO checklist |
| [COMPLIANCE_READINESS.md](./docs/COMPLIANCE_READINESS.md) | SOC 2 / ISO evidence automation |
| [SECURITY.md](./SECURITY.md) | On-device privacy · OWASP alignment |
| [PERFORMANCE.md](./PERFORMANCE.md) | Latency benchmarks |
| [presets/README.md](./presets/README.md) | Adding CVE-style presets |

---

## Project structure

| Path | Description |
|---|---|
| `enterprise/cloud_panel.py` | **CloudPanelService** — SaaS control plane orchestration |
| `enterprise/tenant_manager.py` | Multi-tenant isolation, RBAC, policy overrides |
| `enterprise/siem_exporter.py` | Splunk / Datadog / Elastic + compliance JSONL |
| `harness/core/policy_engine.py` | Core adaptive policy engine |
| `presets/` | Open exploit / PoC preset database |
| `scripts/simulate_vulnerability_preset.py` | Preset runner + public `/demo` JSON |
| `nexus-shield-dashboard/` | Next.js dashboard, `/demo`, `/verify`, runtime APIs |
| `nexus-shield-demo/` | Side-by-side vulnerable vs protected Docker demo |
| `packages/cli/` | Local OpenAI-compatible upstream proxy (Security Engine) |
| `nexus_shield_fast_api.py` | Managed guardrail API |

---

## Tests & quality

```bash
cd nexus-shield-dashboard
npm run test:all
npm run build
```

Harness reproducibility:

```bash
docker run --rm ghcr.io/baturhantasdelen-sudo/harness:latest --eval-mcp
```

---

## SDKs & integrations

```bash
npm install @nexus-shield/sdk
pip install nexus-shield nexus-shield-cli
```

- **VS Code / Cursor:** [VSCODE_EXTENSION.md](./VSCODE_EXTENSION.md)  
- **GitHub Actions:** `baturhantasdelen-sudo/nexus-shield-action@v1`

SDK packages are **Security Engines** (PII / client config). **External interceptors + UAR** provide independent proof — see [GATEWAY_INTEGRATION.md](./docs/GATEWAY_INTEGRATION.md).

---

## Enterprise & contact

| Channel | Link |
|---|---|
| **Website** | [nexusshield.ai](https://nexusshield.ai) |
| **Live dashboard** | [nexus-shield-dashboard.vercel.app](https://nexus-shield-dashboard.vercel.app) |
| **Report 2026** | [State of Agent Security 2026](https://www.nexusshield.ai/reports/state-of-agent-security-2026) |
| **Demo call** | [Book architecture demo](https://cal.com/baturhantasdelen/nexus-shield-demo) |
| **Email** | [baturhantasdelen@gmail.com](mailto:baturhantasdelen@gmail.com) |

---

## License

[MIT License](packages/vscode-extension/LICENSE) — Copyright (c) 2026 Nexus Shield. Commercial enterprise licensing available on request.
