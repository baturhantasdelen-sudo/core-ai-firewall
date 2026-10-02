# Architecture mapping — open source vs enterprise runtime

**Product:** Agent Action Control Plane with **Universal Action Receipts (UAR)**  
**Audience:** Platform engineers, security architects, integration partners

This document maps public GitHub components to the enterprise **data plane** (`nxs` runtime) and optional **Nexus Control Plane**, so teams know what to embed in agents versus what runs as a secured, air-gapped node.

---

## Component matrix

| Layer | Name (codename) | License / availability | Role |
|-------|-----------------|------------------------|------|
| **SDK** | `nexus-agent-sdk-python` ([`packages/python`](../packages/python)) | MIT (open source) | Python client, local receipt helpers, `nexus-shield` CLI |
| **SDK** | `nexus-agent-sdk-bridge` ([`packages/npm`](../packages/npm)) | Open source | Node/TS bridge for agent runtimes and MCP hosts |
| **Evaluation** | `nexus-harness-benchmark` ([`harness/`](../harness)) | Apache 2.0 | Reproducible scenario scoring — **not** production enforcement |
| **Data plane** | **`nxs` runtime** ([`enterprise/data_plane_api.py`](../enterprise/data_plane_api.py), [`nexus/`](../nexus/)) | Enterprise / commercial deployment | Action interceptor, policy engine, UAR ledger, air-gap defaults |
| **Control plane** | **Nexus Control Plane** ([`enterprise/cloud_panel.py`](../enterprise/cloud_panel.py)) | Optional SaaS / licensed | License, fleet orchestration, opt-in telemetry — **not** on hot path when `NEXUS_CLOUD_CONNECT=false` |

**Security Engines** (PII proxy, prompt guardrails, [`nexus_shield_fast_api.py`](../nexus_shield_fast_api.py)) are supporting layers; the **product object** is the **UAR** at the tool-call boundary.

---

## End-to-end lifecycle (ASCII)

```
┌──────────── AI Agent (LangChain, CrewAI, custom MCP host) ────────────┐
│  Declares intent · proposes tool + params                              │
└───────────────────────────────┬───────────────────────────────────────┘
                                │
                    SDK / Bridge contract (open source)
                    inspect · intercept · evaluate HTTP
                                │
                                ▼
┌───────────────────────────────────────────────────────────────────────┐
│  Action Interceptor          (nxs data plane / sidecar / gateway)      │
│       → Authority / RBAC       (tenant, agent identity)                │
│       → Policy Engine          (policy.yaml / policy.effective.yml)    │
│       → ALLOW | BLOCK | READ_ONLY | REQUIRE_APPROVAL                   │
│       → State change           (before_hash / after_hash)              │
│       → UAR sealed             (SHA-256 evidence_bundle_hash)          │
│       → Cryptographic verify   (local recompute, CLI, Proof Center)    │
└───────────────────────────────┬───────────────────────────────────────┘
                                │ optional, opt-in only
                                ▼
                    Nexus Control Plane (license, SIEM fan-out)
```

Canonical verification: [`enterprise/evidence_chain.py`](../enterprise/evidence_chain.py) · CLI: `nexus-shield uar verify`

---

## How external developers use the open-source contract

1. **Install SDK** — `pip install -e .` or `packages/python` / `packages/npm` in your agent repo.
2. **Call the data plane** — `POST /v1/intercept` or `POST /api/v1/action/evaluate` (dashboard proxy) with `agent_id`, `user_intent`, `tool`, `params`.
3. **Handle decision** — execute tool only on `ALLOW`; persist `universal_action_receipt` for audit.
4. **Verify offline** — `nexus-shield uar verify receipt.json` (no cloud required).

Reference integrations:

- [examples/zero-rewrite-mcp/](../examples/zero-rewrite-mcp/) — MCP URL swap only (gateway + policy sidecar)
- [nexus-reference-app/](../nexus-reference-app/) — full sidecar + mock MCP trajectory
- [deploy/helm/nexus-shield/](../deploy/helm/nexus-shield/) — Kubernetes production path

---

## How enterprise nodes run the secure air-gapped data plane

| Control | Mechanism |
|---------|-----------|
| **No mandatory cloud** | `NEXUS_CLOUD_CONNECT=false`, `NEXUS_AIRGAP=true` |
| **Local UAR ledger** | `enterprise/data/uar_receipts.jsonl` (volume in Compose / PVC in Helm) |
| **Secrets** | Vault / AWS Secrets Manager / K8s Secrets via Helm ExternalSecrets |
| **Network** | Sidecar or gateway in customer VPC; LLM egress is customer choice |

Mapping doc for trust & deployment: [TRUST_CENTER_ENTERPRISE.md](./TRUST_CENTER_ENTERPRISE.md)

---

## Related documents

| Document | Purpose |
|----------|---------|
| [UAR_SCHEMA.md](./UAR_SCHEMA.md) | Canonical receipt fields |
| [DATA_PLANE_AND_CONTROL_PLANE.md](./DATA_PLANE_AND_CONTROL_PLANE.md) | Plane separation |
| [architecture-whitepaper.md](./architecture-whitepaper.md) | CISO whitepaper |
