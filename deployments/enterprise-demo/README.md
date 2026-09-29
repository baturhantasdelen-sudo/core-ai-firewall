# Enterprise demo — single-command stack

Spin up a **self-hosted Action Control Plane** trial with mock agent, target API, and live UAR interception.

```bash
cd deployments/enterprise-demo
docker compose up
```

## What starts

| Service | Port | Role |
|---|---|---|
| **nexus-runtime** | `8090` | Action Firewall / UAR data plane (`NEXUS_AIRGAP=true`) |
| **mock-target-api** | `8091` | Stand-in CRM/DB endpoint |
| **mock-agent** | — | LangChain-style tool proposals → intercept loop |

## 2-minute evaluation

1. Wait for `nexus_demo_runtime` healthy (`curl http://localhost:8090/healthz`).
2. Watch mock-agent logs for `decision=` and `evidence=` SHA-256 prefixes.
3. Inspect a receipt manually:

```bash
curl -s -X POST http://localhost:8090/v1/intercept \
  -H "Content-Type: application/json" \
  -d '{"user_intent":"Read-only summary","tool":"export_customer_database","params":{}}'
```

4. **Proof Center / dashboard:** open [Proof Center](https://nexus-shield-dashboard.vercel.app/proof-center) for public harness metrics, or run the dashboard locally and `POST /api/v1/uar/inspect` for instant UAR JSON.

Ledger files persist in Docker volumes `nexus-demo-data` / `nexus-demo-logs`.

## Stop

```bash
docker compose down
```
