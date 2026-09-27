# Nexus Shield deployments — Data Plane vs Control Plane

| Plane | Package | Cloud required? |
|---|---|---|
| **Data Plane (`nexus`)** | Policy runtime, UAR store, local JSONL evidence | **No** — air-gapped / on-prem |
| **Control Plane (`nexus-control`)** | Optional Nexus Cloud — license sync, threat signatures, fleet telemetry | **Optional** |

> **Your AI agents. Your infrastructure. Your data. Your policies.**

## Docker Compose (on-prem / air-gapped)

```bash
cd deployments
docker compose up -d
```

Services:

- **`nexus-runtime`** — Data plane API (`enterprise/data_plane_api.py`) on `:8090`
- **`nexus-guardrail`** — Optional upstream LLM firewall (`nexus_shield_fast_api`) on `:8080` — no outbound cloud when `NEXUS_AIRGAP=true`

Environment:

| Variable | Default | Meaning |
|---|---|---|
| `NEXUS_AIRGAP` | `true` | Disable optional cloud egress |
| `NEXUS_CLOUD_CONNECT` | `false` | Nexus Cloud control plane off |
| `NEXUS_DATA_PLANE_BOOTSTRAP` | `true` | Local demo tenant for first intercept |

Evidence persists under Docker volumes `nexus-enterprise-data` and `nexus-enterprise-logs`.

## Kubernetes (Helm)

```bash
helm upgrade --install nexus-shield ./k8s/nexus-shield \
  --set global.airgap=true \
  --set nexusCloud.connect=false
```

See [docs/DATA_PLANE_AND_CONTROL_PLANE.md](../docs/DATA_PLANE_AND_CONTROL_PLANE.md).
