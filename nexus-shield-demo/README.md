# Nexus Shield Demo — Run your first AI agent security test in 60 seconds.

Compare a **vulnerable agent** (no runtime guardrails) against a **Nexus Shield protected agent** side-by-side.

## Quickstart (60 seconds)

```bash
# 1. Clone and enter demo
cd nexus-shield-demo

# 2. Launch vulnerable + protected agents
docker compose up -d --build

# 3. Attack the vulnerable agent (destructive tool call)
curl -s -X POST http://localhost:3001/agent/act \
  -H "Content-Type: application/json" \
  -d '{"intent":"summarize invoice","tool":"delete_database","args":{"target":"customers"}}'

# 4. Same attack against protected agent — blocked with proof
curl -s -X POST http://localhost:8080/v1/shield/action \
  -H "Content-Type: application/json" \
  -H "X-API-Key: demo-key" \
  -d '{"intent":"summarize invoice","tool":"delete_database","args":{"target":"customers"}}'
```

### Expected terminal output (protected path)

```
ATTEMPTED DELETE -> BLOCKED BY NEXUS SHIELD (5.8ms) -> PROOF GENERATED
evidence_hash=sha256:a50455955e7f2c91...
policy=INTENT_MISMATCH | trajectory=VIOLATION
audit_id=NS-EV-8842
```

## Install Nexus Shield SDK

**Node.js / TypeScript**

```bash
npm install @nexus-shield/sdk
# or published package:
npm install @baturhantasdelen/nexus-shield
```

```typescript
import { NexusShield } from '@nexus-shield/sdk';

const shield = new NexusShield({ apiKey: process.env.NEXUS_API_KEY });
const verdict = await shield.evaluateAction({
  userIntent: 'Summarize invoice #4421',
  toolCall: { name: 'delete_database', args: { target: 'customers' } },
});
// verdict.decision === 'BLOCKED' → evidence chain attached automatically
```

**Python**

```bash
pip install nexus-shield
```

```python
from nexus_shield import NexusShield

shield = NexusShield(api_key=os.environ["NEXUS_API_KEY"])
verdict = shield.evaluate_action(
    user_intent="Summarize invoice #4421",
    tool_call={"name": "delete_database", "args": {"target": "customers"}},
)
# verdict.decision == "BLOCKED" — cryptographic proof generated
```

## Demo architecture

| Service | Port | Description |
|---------|------|-------------|
| `vulnerable-agent` | 3001 | Accepts any tool call — no intent verification |
| `nexus-shield-proxy` | 8080 | Action Firewall + evidence chain (protected path) |

## Growth funnel

1. **Attack** — run the interactive simulator at `/` → `#attack-simulator` or `ATTACK MY AGENT`
2. **Prove** — free scan at `/scan` → downloadable Agent Security Report
3. **Install** — `npm install @nexus-shield/sdk` or `pip install nexus-shield`
4. **Protect** — route agent traffic through port `8080`

## Tear down

```bash
docker compose down
```
