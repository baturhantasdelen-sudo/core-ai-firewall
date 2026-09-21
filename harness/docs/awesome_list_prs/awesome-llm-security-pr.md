# PR — awesome-llm-security

Submit to: https://github.com/corca-ai/awesome-llm-security

**Suggested section:** Benchmark

## Entry (copy-paste)

```markdown
- [Nexus Shield MCP Security Harness](https://github.com/baturhantasdelen-sudo/harness) - Standardized **MCP-SEC-SCORE** (0–100) benchmark for Model Context Protocol servers — measures resistance to indirect prompt injection, cross-tool data leaks, and privilege escalation with reproducible JSON evidence bundles. [Live Proof Center →](https://nexusshield.ai/docs/benchmark)
```

## PR title suggestion

```
docs: add MCP-SEC-SCORE harness to Benchmark
```

## PR body template

```markdown
## Summary

Adds the Nexus Shield MCP Security Harness with the standardized **MCP-SEC-SCORE** metric for evaluating LLM agent + MCP tool chain security.

### Highlights

| Metric | Description |
|---|---|
| MCP-SEC-SCORE | 0–100 composite security score |
| Grade | A+ through F letter grade |
| Vectors | Indirect injection, SSRF, path traversal, cross-tool exfil |

Repository: https://github.com/baturhantasdelen-sudo/harness  
Live results: https://nexusshield.ai/docs/benchmark

## Checklist

- [x] Resource is actively maintained (Apache 2.0)
- [x] Focused on LLM / agent security benchmarking
- [x] Includes reproducible open-source runner
```
