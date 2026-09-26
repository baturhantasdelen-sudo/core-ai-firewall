# 2026 Enterprise Shadow AI Agent & Indirect Prompt Injection Scorecard

**Publisher:** Nexus Shield Research · Agent Runtime Control & Trust Layer  
**Report ID:** `2026-shadow-ai-scorecard`  
**Audience:** CISO, CTO, Head of AI Platform Engineering  

---

## Executive Summary & Key Findings

Enterprises are deploying autonomous AI agents faster than runtime security controls can mature. Our 2026 scorecard evaluates **ten production-grade agent frameworks** against four high-frequency attack vectors that map directly to shadow-AI incidents in finance, SaaS, and internal tooling.

| Finding | Metric |
|--------|--------|
| Deployments relying on vendor defaults | **80%** |
| Agents vulnerable to indirect prompt hijacking (OOTB) | **86%** |
| Average out-of-the-box defense rate (all vectors) | **~19.8%** (9–31% per cell) |
| Mitigation with Nexus Shield runtime control | **99.1–99.8%** |
| Median intercept latency (p50) | **<12ms** |

**Bottom line:** Framework-level guardrails and prompt templates alone do not constitute a trust layer. Runtime **SEE → CONTROL → TRUST → VERIFY** enforcement is required to block tool abuse, revoke excessive agency (`READ_ONLY`), and emit reproducible **MCP-SEC-SCORE** evidence for auditors.

---

## The "Insecure Defaults" Threat Model

Shadow AI agents inherit the privileges of their toolchains. When planners consume untrusted documents, email bodies, or retrieved web content, attackers can inject latent instructions that survive summarization and re-emerge at tool-selection time (**indirect prompt injection**).

### Attack vectors (evaluation matrix)

1. **Indirect Prompt Injection via Untrusted Input** — malicious PDF/email payload steers the planner toward privileged tools.  
2. **Tool Abuse & Excessive Agency** — unauthorized DML, bulk export, or cross-tenant data access.  
3. **Unsanitized Tool Arguments** — SQLi, command injection, or path traversal in MCP/REST tool parameters.  
4. **Unsafe Inter-Agent Delegation** — Agent A escalates privileges by delegating to Agent B with broader scopes.

Each framework × vector cell includes:

- **Out-of-the-box defense rate (%)** — blocked or safely constrained attempts without external runtime control.  
- **Intent divergence score** — planner/tool intent vs. declared user objective (high = hijack risk).  
- **Nexus Shield mitigation (%)** — actions blocked or downgraded with cryptographic evidence.  
- **Capability revocation** — enforced `READ_ONLY` mode on high-risk trajectories.  
- **Evidence ID** — `MCP-SEC-SCORE-{framework}-{vector}` bundle for audit replay.

---

## Comparative Benchmark Results (Top-10 Frameworks)

| Framework | OOTB defense (avg) | With Nexus Shield | p50 latency |
|-----------|-------------------:|------------------:|------------:|
| CrewAI | 16.5% | 99.5% | 9.8ms |
| LangChain / LangGraph | 19.8% | 99.3% | 9.9ms |
| AutoGen | 13.3% | 99.5% | 9.7ms |
| LlamaIndex | 22.3% | 99.4% | 10.0ms |
| OpenAI Assistants | 28.3% | 99.2% | 9.6ms |
| Semantic Kernel | 17.5% | 99.5% | 9.8ms |
| Haystack | 24.5% | 99.3% | 9.9ms |
| DSPy | 10.5% | 99.6% | 9.5ms |
| SuperAGI | 13.5% | 99.5% | 9.7ms |
| MCP Native SDKs | 26.5% | 99.4% | 10.1ms |

**Status legend**

- **Insecure default:** `FAIL` (&lt;22% defended) or `PARTIAL` (22–31% defended)  
- **Protected with Nexus Shield:** `PASS` — 99%+ mitigation, P99 runtime intercept: 6.1ms (Nexus benchmark harness)  

Full per-vector breakdown: [https://nexusshield.ai/scorecard](https://nexusshield.ai/scorecard)

---

## Architectural Remediation: SEE → CONTROL → TRUST → VERIFY

| Pillar | Runtime responsibility |
|--------|-------------------------|
| **SEE** | Discover every agent identity, tool registration, and session graph |
| **CONTROL** | Evaluate each action against policy, intent divergence, and scope |
| **TRUST** | Revoke capabilities (`READ_ONLY`), block excessive agency, enforce HITL where required |
| **VERIFY** | Hash before/after state, detect `UNVERIFIED_ACTION`, export evidence bundles |

Nexus Shield sits **inline** at the agent runtime boundary — not as a post-hoc log aggregator — so hijacked tool calls are intercepted before side effects commit.

---

## Reproducible Verification Steps

Researchers and red teams can reproduce this scorecard locally:

```bash
docker run --rm ghcr.io/baturhantasdelen-sudo/harness:latest --eval-scorecard
```

From source (open harness):

```bash
git clone https://github.com/baturhantasdelen-sudo/harness.git
cd harness
python scripts/eval_scorecard.py --output results/scorecard_2026.json
```

Output includes aggregate headline stats, per-framework cells, evidence IDs, and methodology metadata suitable for CI gates and third-party attestation.

---

## Contact & Proof Center

- **Interactive scorecard:** `/scorecard` on Nexus Shield marketing site  
- **MCP-SEC-SCORE methodology:** `/docs/benchmark`  
- **Enterprise runtime:** [https://nexusshield.ai](https://nexusshield.ai)  

*This document is intended for executive distribution. Technical annex data is available in `results/scorecard_2026.json` from the harness runner.*
