# Nexus Shield Security Engines — In-RAM PII Guardrail (Node.js SDK)

Nexus Shield’s **primary platform** is **Agent Action Governance & Verification** ([dashboard](https://nexus-shield-dashboard.vercel.app)): runtime decisions on agent tool calls, Universal Action Receipts, and adaptive degradation (`READ_ONLY`, `REQUIRE_APPROVAL`).

**This package** is a **Security Engine**: an in-RAM PII redaction proxy for the Vercel AI SDK, LangChain, and Node.js LLM apps. Platform agent-action benchmark: **P99 runtime intercept: 6.1ms (Nexus benchmark harness)**.

### Performance comparison (300 payloads — PII engine micro-benchmark)

| Engine | Avg Latency (P50) | P99 Latency | Memory Overhead |
| :--- | :---: | :---: | :---: |
| **Nexus Shield (In-RAM)** | **< 2.4 ms** | **< 6.1 ms** | **~12 MB** |
| Standard Python Regex | 18.2 ms | 45.1 ms | ~45 MB |
| MS Presidio (spaCy NER) | 120.5 ms | 245.0 ms | ~450 MB |

### Quick start

```typescript
import { NexusShield } from '@baturhantasdelen/nexus-shield';

const nexus = new NexusShield({
  baseUrl: 'https://api.nexusshield.ai/v1',
  apiKey: 'nx_live_...',
});
```

For governance APIs (verify + receipts), see the monorepo README and `POST /api/v1/actions/verify`.
