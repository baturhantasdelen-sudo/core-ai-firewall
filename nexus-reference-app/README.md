# Nexus Reference App

Minimal **Action Control Plane** stack for local-first demos:

| Service | Port | Role |
|---------|------|------|
| `nexus-sidecar` | 8090 | `POST /v1/intercept` + UAR sealing |
| `mcp-server` | 8100 | MCP tool simulation |
| `sample-agent` | — | Trajectory demo (4 governed steps) |
| `uar-sealer` | — | Health hook against sidecar UAR engine |

```bash
# from repository root
docker compose -f nexus-reference-app/docker-compose.yml up --build
curl -s http://localhost:8090/healthz
```

See [docs/under-the-hood.md](../docs/under-the-hood.md) for the 8-step evidence chain mapped to source modules.

Enterprise trust, Helm, and secret management: [docs/TRUST_CENTER_ENTERPRISE.md](../docs/TRUST_CENTER_ENTERPRISE.md).
