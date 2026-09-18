# Nexus Shield Demo Recordings

Automated Trust Hub screen recordings using Playwright (Chromium).

## Setup

```bash
cd demos
npm install
npm run install:browsers
```

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `TRUST_HUB_URL` | `http://127.0.0.1:3000/dashboard/trust-hub` | Dashboard Trust Hub page (GCP: use `:3001` if Grafana uses `:3000`) |
| `API_BASE_URL` | `https://api.nexusshield.ai` | Fast API for agent actions / benchmark |
| `DEMO_LOGIN_EMAIL` | — | Required when Supabase auth is enabled |
| `DEMO_LOGIN_PASSWORD` | — | Required when Supabase auth is enabled |
| `NEXUS_DEMO_BYPASS_AUTH` | — | Set `1` on dashboard server for local recording without login |
| `DEMO_HEADLESS` | — | Set `1` to run headless (videos still recorded) |

## Run

### GCP production server

Port **3000** is used by **Grafana**. Start the Next.js dashboard demo server on **3001** first, then run from the **repo root**:

```bash
cd /opt/nexus-core-firewall

# Dashboard (once per session)
cd nexus-shield-dashboard
NEXUS_DEMO_BYPASS_AUTH=1 \
NEXT_PUBLIC_API_URL=http://127.0.0.1:8080 \
NEXUS_SHIELD_API_URL=http://127.0.0.1:8080 \
nohup npm run dev -- -p 3001 -H 127.0.0.1 > /tmp/nexus-dashboard-demo.log 2>&1 &

# Record demos (repo root)
cd /opt/nexus-core-firewall
NEXUS_DEMO_BYPASS_AUTH=1 \
DEMO_HEADLESS=1 \
API_BASE_URL=http://127.0.0.1:8080 \
TRUST_HUB_URL=http://127.0.0.1:3001/dashboard/trust-hub \
bash scripts/run_demos.sh
```

Videos: `/opt/nexus-core-firewall/demos/videos/`

### Local / default

From repo root:

```bash
bash scripts/run_demos.sh
```

Or individually:

```bash
cd demos
npm run demo1   # → videos/demo1_performance.webm
npm run demo2   # → videos/demo2_evidence_hitl.webm
```

## Prerequisites

1. Fast API running (`8080`) with governance routes enabled.
2. Dashboard running (`3000` locally, **`3001` on GCP**) or Vercel URL in `TRUST_HUB_URL`.
3. For Demo 2, `/v1/agent/action` must return `PENDING_APPROVAL` with an `approval_id`.
