# Nexus Shield — Architecture White Paper

**Positioning:** Runtime **Agent Action Governance & Verification** — not a generic multi-agent collaboration suite or prompt-only firewall.

> Nexus combines runtime action governance, trajectory-aware control, and verifiable cryptographic evidence into a single air-gapped deployment layer.

**Core question:** *Your AI agent can call your APIs. Who verifies the action?*

---

## Execution flow (product spine)

```
Interception (SEE) → Authority / Policy (CONTROL) → Execution → State Change → Cryptographic Proof (VERIFY)
```

| Phase | Responsibility | Primary artifacts |
|---|---|---|
| **SEE** | Discover agents, MCP tools, declared capabilities | Agent inventory, scan funnel (`/scan`) |
| **CONTROL** | Intent vs tool evaluation, BLOCK / READ_ONLY / APPROVAL | `POST /api/v1/action/evaluate`, `POST /v1/intercept` |
| **EXECUTE** | Tool runs only after policy allows | Host app / MCP server |
| **PROVE** | UAR seal, ledger, `/verify` | `evidence_hash`, SIEM JSONL |

Supporting capabilities (Threat Intel, Red Team, Trust Hub, Compliance, prompt/PII engines) **extend** the Action Control Plane — they are not parallel product lines.

---

## Repository hierarchy (monorepo ecosystem)

### 1. Harness benchmark — `nexus-harness-benchmark` (`harness/`)

**Independent evaluation system** for agent trajectories, deterministic CVE-style presets, and evidence-first scoring.

- Open reproducible scores (MCP-SEC-SCORE, Proof Center benchmark lane)
- **Not** the production enforcement layer
- See [BENCHMARK_VS_ACTION_FIREWALL.md](./BENCHMARK_VS_ACTION_FIREWALL.md)

### 2. SDK & bridge — `nexus-agent-sdk-python`, `nexus-agent-sdk-bridge`

**Secure runtime transition layer** between host applications, MCP servers, and the governed agent process.

| Package | Path | Role |
|---|---|---|
| Python SDK | `packages/python` | Evaluate actions, proxy config, UAR client helpers |
| Bridge SDK | `packages/npm` | Node / Vercel AI SDK — wrap tool calls before execution |
| CLI proxy | `packages/cli` | Optional upstream LLM guardrail (supporting engine) |

Standard receipt shape: [ACTION_RECEIPT_API.md](./ACTION_RECEIPT_API.md) · JSON Schema: [../schemas/uar_action_receipt.schema.json](../schemas/uar_action_receipt.schema.json)

### 3. Control & data plane — `nexus-control`, core `nexus`

**Real-time action governance, policy enforcement, and cryptographic proof generation.**

| Codename | Path | Role |
|---|---|---|
| **`nexus`** (data plane) | `enterprise/data_plane_api.py`, `uar_store.py`, `evidence_chain.py` | Intercept, UAR ledger, air-gap default |
| **`nexus-control`** | `enterprise/cloud_panel.py`, `tenant_manager.py` | Optional orchestration, RBAC, SIEM export |

Dashboard & public Proof Center: `nexus-shield-dashboard/` (UI only — governance runtime remains self-hostable).

---

## Deployment trust model

- **`NEXUS_AIRGAP=true`** — no required vendor egress
- **`NEXUS_CLOUD_CONNECT=false`** — control plane off; full governance local
- Docker / Helm: [deployments/](../deployments/) · **2-minute trial:** [deployments/enterprise-demo/README.md](../deployments/enterprise-demo/README.md)

---

## Related documents

| Document | Topic |
|---|---|
| [ENTERPRISE_PITCH_AND_VISION.md](./ENTERPRISE_PITCH_AND_VISION.md) | CISO narrative |
| [UAR_SCHEMA.md](./UAR_SCHEMA.md) | Canonical UAR fields |
| [DATA_PLANE_AND_CONTROL_PLANE.md](./DATA_PLANE_AND_CONTROL_PLANE.md) | Plane separation |
| [GATEWAY_INTEGRATION.md](./GATEWAY_INTEGRATION.md) | Enterprise gateway placement |
