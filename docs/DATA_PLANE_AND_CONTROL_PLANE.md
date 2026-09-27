# Data Plane vs Control Plane

Nexus Shield separates **what must run in your environment** from **what may optionally connect to Nexus Cloud**.

## GTM promise

**Your AI agents. Your infrastructure. Your data. Your policies.**

## Planes

| Plane | Codename | Runs where | Requires internet? |
|---|---|---|---|
| **Data Plane** | `nexus` | Customer VPC, on-prem, air-gapped K8s | **No** |
| **Control Plane** | `nexus-control` | Optional Nexus Cloud SaaS | Only if enabled |

### Data Plane (`nexus`)

- `harness/core/policy_engine.py` — runtime ALLOW / BLOCK / READ_ONLY / REQUIRE_APPROVAL
- `enterprise/cloud_panel.py` — `CloudPanelService` when self-hosted
- `enterprise/data_plane_api.py` — HTTP API for sidecar / MCP / API integration
- **Local evidence:** `enterprise/data/uar_receipts.jsonl`, tenant registry JSON, compliance JSONL under `enterprise/logs/`

### Control Plane (`nexus-control`) — optional

When `NEXUS_CLOUD_CONNECT=true`:

- License sync
- Fleet telemetry (opt-in)
- Shared threat signature updates

When `NEXUS_CLOUD_CONNECT=false` (default in [deployments/docker-compose.yml](../deployments/docker-compose.yml)):

- All interception, UAR sealing, SIEM export, and audit logs remain **fully local**.

## Deployment models

| Model | Description |
|---|---|
| **Cloud** | Dashboard + optional managed guardrail at `api.nexusshield.ai` |
| **Private cloud** | Data plane in your VPC; optional control plane peering |
| **On-prem / air-gapped** | [deployments/](../deployments/) Compose or Helm — no egress |
| **Sidecar / API / MCP** | Agent calls `POST /v1/intercept` on co-located `nexus-runtime` |

## Quick start (air-gapped)

```bash
cd deployments
NEXUS_AIRGAP=true NEXUS_CLOUD_CONNECT=false docker compose up -d
curl http://localhost:8090/healthz
```

See [GATEWAY_INTEGRATION.md](./GATEWAY_INTEGRATION.md) for LLM router placement.
