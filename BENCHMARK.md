# Nexus Agent Action Assurance Benchmarks

**Platform:** Business Action Assurance & Accountability  
**Philosophy:** *DO NOT TRUST THE AGENT. DO NOT TRUST THE TOOL RESPONSE. VERIFY THE WORLD.*

| Suite | Command | Result |
|-------|---------|--------|
| **nexus-core** (pipeline + outcome) | `npm run test:nexus-core` | **24 / 24 PASS** |
| **A2B** (Finance / ERP / CRM) | `npm run test:benchmark` | **20 / 20 PASS** |

| Metric | Result |
|--------|--------|
| False Success Detection Rate (A2B + outcome fixtures) | **100%** |
| Outcome scenario accuracy (12 tests) | **12 / 12** |
| A2B vertical scenarios | **20 / 20** |
| Production Definition of Done (outcome) | **42 / 42** |

**Documentation**

- [docs/ASSURANCE_AND_UAR20.md](docs/ASSURANCE_AND_UAR20.md) — Assurance Core, UAR 2.0, Proof Center, A2B
- [docs/benchmark-2027.md](docs/benchmark-2027.md) — Outcome Verification Engine (12 scenarios)

**Reproduce**

```bash
cd nexus-shield-dashboard
npm run test:nexus-core
npm run test:benchmark
```
