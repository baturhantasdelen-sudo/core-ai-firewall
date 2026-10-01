# Security Benchmarks & Open Transparency Report

Template for publishing **reproducible harness scores** and **raw evidence pointers**. Production UAR ledgers remain on your data plane; this document lists public benchmark artifacts only.

---

## 1. Harness identity

| Field | Value |
|-------|-------|
| Codename | `nexus-harness-benchmark` |
| Repository path | [`harness/`](../harness/) |
| Scenario corpus | [`harness/scenarios/mcp_hijack/`](../harness/scenarios/mcp_hijack/) |
| Docker sandbox | [`harness/docker/mcp-sandbox/`](../harness/docker/mcp-sandbox/) |

---

## 2. Published score snapshots (raw JSON)

| Report | Path | Description |
|--------|------|-------------|
| MCP leaderboard | [`harness/results/mcp_leaderboard.json`](../harness/results/mcp_leaderboard.json) | MCP-SEC-SCORE aggregate, scenario metadata |
| 2026 scorecard | [`harness/results/scorecard_2026.json`](../harness/results/scorecard_2026.json) | Yearly rollup |
| Sample harness output | [`harness/fixtures/sample-output.json`](../harness/fixtures/sample-output.json) | Shape reference for integrators |
| Scenario index | [`harness/scenarios/index.json`](../harness/scenarios/index.json) | Enumerates reproducible cases |

**Reproduce locally:**

```bash
cd harness
npm ci
npm run eval:mcp
# or Docker MCP sandbox — see harness/README.md
```

---

## 3. Transparency checklist (fill per release)

| Item | Status | Notes |
|------|--------|-------|
| Harness commit SHA | _e.g. `main@7f42a8c`_ | Pin in release notes |
| Scenario count | _from `mcp_leaderboard.json`_ | |
| Strict mode | _true/false_ | |
| MCP-SEC-SCORE | _numeric_ | Marketing must label as **benchmark lane** |
| Raw logs archived | _CI artifact URL_ | |
| Production UAR sample | _redacted intercept JSON_ | Optional customer appendix |

---

## 4. Benchmark vs action firewall

| Lane | Proves | Does not prove |
|------|--------|----------------|
| Harness | Framework scores on fixed scenarios | Your agents' live decisions |
| Data plane UAR | What was attempted & decided in production | Leaderboard rank |

Details: [BENCHMARK_VS_ACTION_FIREWALL.md](./BENCHMARK_VS_ACTION_FIREWALL.md)

---

## 5. OWASP / standards tags

Harness exports include OWASP GenAI and Agentic AI reference URLs (see `standards_alignment` in `mcp_leaderboard.json`). Tags are **mapping aids**, not formal certification.

---

## 6. Contact & responsible disclosure

See [SECURITY.md](../SECURITY.md) and repository security advisories.
