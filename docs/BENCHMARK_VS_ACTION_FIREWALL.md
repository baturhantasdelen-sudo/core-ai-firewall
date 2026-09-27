# `nexus-harness-benchmark` vs Action Firewall

Strict separation for academic reproducibility and production security clarity.

> **Know what your agents are allowed to do. Stop what they shouldn't. Prove what actually happened.**

Production proof is the **UAR ledger**, not harness scores. See [UAR_SCHEMA.md](./UAR_SCHEMA.md).

## Proof Center — two lanes

| Lane | Source | Use |
|---|---|---|
| **Reproducible benchmark results** | `nexus-harness-benchmark` | Transparency for evaluation & research |
| **Deterministic action evidence (UAR ledger)** | Data plane `nexus` | Audit what your agents actually attempted |

## Summary

| | **nexus-harness-benchmark** | **Nexus Action Firewall (runtime)** |
|---|---|---|
| **Purpose** | Open, reproducible **evaluation & scoring** of agent frameworks | **Live interception** of tool calls in production |
| **Location** | `harness/` in this repo | `nexus-shield-dashboard` APIs, `enterprise/`, `api.nexusshield.ai` |
| **Output** | Leaderboards, scorecards, scenario JSON | UAR receipts, kill switch, adaptive degradation |
| **Use in sales / architecture** | Research, benchmarks, CVE presets | Customer data plane — **never substitute for runtime** |

## nexus-harness-benchmark

The harness (`harness/core/policy_engine.py` used in presets) is a **reference evaluator** for:

- MCP tool-hijack scenarios
- Intent divergence scoring
- Reproducible CVE-style presets under `presets/`

Run benchmarks:

```bash
docker run --rm ghcr.io/baturhantasdelen-sudo/harness:latest --eval-mcp
python scripts/simulate_vulnerability_preset.py --all
```

**The harness does not** replace deployed Action Firewall enforcement at the agent boundary.

## Action Firewall (production)

Runtime governance:

- `POST /api/v1/action/evaluate` (dashboard)
- `enterprise` data plane `POST /v1/intercept`
- Upstream LLM guardrail `POST /v1/shield`

Produces **Universal Action Receipts** with SHA-256 evidence chains — see [evidence_chain.py](../enterprise/evidence_chain.py).

## Documentation rule

When writing README or customer-facing copy:

- Say **“harness benchmark”** or **`nexus-harness-benchmark`** for evaluation artifacts.
- Say **“Action Firewall”** or **“data plane runtime”** for live blocking and UAR sealing.
