# Data Plane vs Control Plane

Nexus Shield is an **AI Agent Action Governance & Verification Platform**.

> **Know what your agents are allowed to do. Stop what they shouldn't. Prove what actually happened.**

We separate **what must run in your environment** (data plane / **`nexus`**) from **what may optionally connect to Nexus Cloud** (control plane / **`nexus-control`**).

## Infrastructure promise

**Your AI agents. Your infrastructure. Your data. Your policies.**

## Planes

| Plane | Codename | Runs where | Requires internet? |
|---|---|---|---|
| **Data Plane** | `nexus` | Customer VPC, on-prem, air-gapped K8s | **No** |
| **Control Plane** | `nexus-control` | Optional Nexus Cloud SaaS | Only if enabled |

### Data Plane (`nexus`) — governance & UAR ledger

Authoritative for **live decisions** and **deterministic action evidence**:

- `harness/core/policy_engine.py` — runtime ALLOW / BLOCK / READ_ONLY / REQUIRE_APPROVAL
- `enterprise/cloud_panel.py` — `CloudPanelService` when self-hosted
- `enterprise/data_plane_api.py` — HTTP API; every `POST /v1/intercept` returns a **UAR envelope**
- **Local UAR ledger:** `enterprise/data/uar_receipts.jsonl` (not cloud-dependent)
- Compliance JSONL: `enterprise/logs/`

Primary product object: **Universal Action Receipt** — [UAR_SCHEMA.md](./UAR_SCHEMA.md)

### Control Plane (`nexus-control`) — optional

When `NEXUS_CLOUD_CONNECT=true` only:

- License sync
- Opt-in fleet telemetry
- Shared threat signature updates

When `NEXUS_CLOUD_CONNECT=false` (default in [deployments/docker-compose.yml](../deployments/docker-compose.yml)):

- Interception, UAR sealing, SIEM export, and audit logs stay **fully local**.

## Proof Center transparency

| Artifact | Plane | Purpose |
|---|---|---|
| **Reproducible benchmark results** | Harness / evaluation | Academic & comparative **scores** — [BENCHMARK_VS_ACTION_FIREWALL.md](./BENCHMARK_VS_ACTION_FIREWALL.md) |
| **UAR ledger / action evidence** | Data plane `nexus` | **What happened** in your environment — cryptographically sealed |

Never substitute harness leaderboard metrics for production UAR proof.

## Deployment models

| Model | Description |
|---|---|
| **Cloud** | Dashboard + optional managed runtime at `api.nexusshield.ai` |
| **Private cloud** | Data plane in your VPC; optional control plane |
| **On-prem / air-gapped** | [deployments/](../deployments/) — no egress |
| **Sidecar / API / MCP** | `POST /v1/intercept` on co-located `nexus-runtime` |

## Quick start (air-gapped)

```bash
cd deployments
NEXUS_AIRGAP=true NEXUS_CLOUD_CONNECT=false docker compose up -d
curl http://localhost:8090/healthz
```

See [GATEWAY_INTEGRATION.md](./GATEWAY_INTEGRATION.md) for LLM router placement (supporting path — core object remains the UAR).
