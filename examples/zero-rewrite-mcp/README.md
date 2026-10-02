# Zero-rewrite MCP integration

Demonstrates **Agent Action Control Plane** enforcement without rewriting agent code: point `MCP_SERVER_URL` at the **MCP gateway** instead of the raw MCP server.

## Architecture

```
Agent (agent_client.py)
    │  MCP JSON-RPC (unchanged client code)
    ▼
MCP Gateway (:8200)  ──POST /v1/intercept──►  Policy Sidecar (:8091, policy.yaml)
    │ ALLOW only
    ▼
Mock MCP Server (:8100)  — read_invoice, post_payment
```

## Quick start (~30 minutes)

From repository root:

```bash
docker compose -f examples/zero-rewrite-mcp/docker-compose.yml up --build
```

Expected behavior:

1. **`read_invoice`** → `ALLOW` + upstream MCP execution + UAR with `evidence_bundle_hash`
2. **`post_payment`** (no approval) → `BLOCK` + no upstream execution
3. **`post_payment`** with `approved: true` in arguments → `ALLOW`

Verify a saved receipt locally:

```bash
pip install -e .
nexus-shield uar verify examples/sample-receipt.json
```

## Zero-rewrite deployment checklist

| Step | Action |
|------|--------|
| 1 | Deploy policy sidecar (or full `nxs` data plane) in your VPC |
| 2 | Configure `policy.yaml` tool rules |
| 3 | Change agent env: `MCP_SERVER_URL=https://your-gateway/mcp` |
| 4 | Verify UARs: `nexus-shield uar verify receipt.json` |

See [docs/ARCHITECTURE_MAPPING.md](../../docs/ARCHITECTURE_MAPPING.md) for open-source vs enterprise runtime boundaries.
