# Quick Start for Developers (CLI & Docker Compose)

Nexus Shield is an **Action Control Plane** with tamper-evident **Universal Action Receipts (UAR)**. This guide covers the fastest local paths for engineers.

## Prerequisites

- Python **3.10+**
- Docker Desktop / Docker Engine + Compose v2
- Git

## One-line install (CLI)

From the repository root:

```bash
git clone https://github.com/baturhantasdelen-sudo/core-ai-firewall.git
cd core-ai-firewall
pip install -e .
nexus-shield --version
```

Equivalent package path:

```bash
pip install -e packages/python
```

## CLI commands

| Command | Purpose |
|---------|---------|
| `nexus-shield reference up --build -d` | Start Phase 1–4 reference stack (`:8090` sidecar, `:8100` mock MCP) |
| `nexus-shield reference down` | Stop reference stack (`down --remove-orphans`) |
| `nexus-shield policy test` | Run policy + governance pytest suite |
| `nexus-shield uar verify <receipt.json>` | Verify SHA-256 UAR integrity locally |
| `nexus-shield proxy -p 8080` | Optional PII proxy (requires `pip install -e packages/cli` or `[proxy]` extras) |

Set `NEXUS_SHIELD_ROOT=/path/to/core-ai-firewall` if you run the CLI outside the clone directory.

### Reference stack (no CLI)

```bash
docker compose -f docker-compose.nexus-reference.yml up --build -d
curl -fsS http://127.0.0.1:8090/healthz
```

See [integration-quickstart.md](./integration-quickstart.md) and [under-the-hood.md](./under-the-hood.md).

## Full local dev stack (Fast API + ML + nginx + metrics)

```bash
docker compose -f docker-compose.yml up -d --build
# :80 gateway, :8080 Fast API, :8000 ML API, :3000 Grafana
```

CI-style lightweight stack:

```bash
docker compose -f docker-compose.fast.yml up -d --build
```

## Policy & governance tests

```bash
nexus-shield policy test
# or
python -m pytest tests/test_policy_engine.py tests/test_governance_framework.py -v
```

## Python SDK

```python
from nexus_shield import NexusClient, build_action_receipt, inspect_action

client = NexusClient(base_url="http://127.0.0.1:8080/v1", api_key="your-key")
```

Package source: [`packages/python/`](../packages/python/).

## Next steps

- Enterprise Kubernetes: [ENTERPRISE_HELM_DEPLOY.md](./ENTERPRISE_HELM_DEPLOY.md)
- Trust Center (Helm, secrets, air-gap): [TRUST_CENTER_ENTERPRISE.md](./TRUST_CENTER_ENTERPRISE.md)
- Open source vs enterprise runtime: [ARCHITECTURE_MAPPING.md](./ARCHITECTURE_MAPPING.md)
- Zero-rewrite MCP: [examples/zero-rewrite-mcp/](../examples/zero-rewrite-mcp/)
- UAR schema: [UAR_SCHEMA.md](./UAR_SCHEMA.md)
- Production VM (GCP Compose): [../DEPLOYMENT.md](../DEPLOYMENT.md)
