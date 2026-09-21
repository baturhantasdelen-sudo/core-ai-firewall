# Adapter Security Report — Issue / PR Template

Copy-paste into an MCP server maintainer's GitHub Issues or PR comments.

---

## 🛡️ Security Audit & MCP-Sec Benchmark Report

Hi maintainers! We benchmarked `@modelcontextprotocol/server-postgres` using the open-source [MCP Security Harness](https://github.com/baturhantasdelen-sudo/harness).

### Results

| Metric | Value |
|---|---|
| **Security Grade** | A (96.1 / 100) |
| **MCP-SEC-SCORE** | 96.1 |
| **Evaluated Vectors** | Indirect Prompt Injection, Cross-Tool Leakage, Path Traversal |
| **Block Rate** | 100% (5/5 scenarios) |

### Full report

**Proof Center:** https://nexusshield.ai/docs/benchmark

### Reproduce locally

```bash
git clone https://github.com/baturhantasdelen-sudo/harness.git
cd harness
python -m runners.mcp_runner --scenarios scenarios/mcp_hijack/ --output results/mcp_leaderboard.json
```

### Embed your security badge

Feel free to add the official MCP-Sec Verified badge to your README:

```markdown
[![MCP-Sec Verified Grade A](https://img.shields.io/badge/MCP--SEC--SCORE-96.1%20%7C%20Grade%20A-brightgreen?style=flat-square&logo=shield)](https://nexusshield.ai/docs/benchmark)
```

Generate updated badges anytime:

```bash
python -m runners.badge_generator --input results/mcp_leaderboard.json
```

---

### Customization checklist

Replace placeholders before sending:

- [ ] `@modelcontextprotocol/server-postgres` → target adapter name
- [ ] Grade / score → from your `results/mcp_leaderboard.json`
- [ ] Evaluated vectors → from scenario categories
- [ ] Badge URL → output of `runners/badge_generator.py`

---

*Benchmark harness is Apache 2.0 — no proprietary data or credentials required.*
