# AI Enterprise Stack

**NexusShield + ResoNet Gateway** — a twin-pillar, OpenAI-compatible Enterprise AI Proxy Gateway that unifies **AI security governance** and **thermodynamic sustainability** behind a single production port.

| Pillar | Product | Mission |
|--------|---------|---------|
| **Security** | **NexusShield** | PII/PHI anonymization, prompt-injection blocking, DLP-aligned guardrails |
| **Sustainability** | **ResoNet Gateway** | Semantic compression, Ollama/cloud smart routing, real-time water & energy telemetry |

**Production URL (single port):** `http://localhost:8080`

---

## Executive Summary

Enterprise adoption of large language models has outpaced the infrastructure required to govern them safely and operate them sustainably. Every cloud inference call carries two hidden liabilities:

1. **Governance & Security Risk** — Unfiltered prompts leak PII/PHI, enable prompt injection, and bypass corporate data-loss-prevention (DLP) policies. A single exfiltration event can trigger regulatory penalties under GDPR, HIPAA, and ISO 27001.
2. **Thermodynamic Cost** — Cloud LLM inference consumes measurable water (data-center cooling) and energy per token. Without visibility, ESG reporting remains anecdotal and FinOps teams cannot attribute AI spend to environmental impact.

**AI Enterprise Stack** solves both problems with a unified proxy layer. All AI traffic passes through NexusShield (security) and ResoNet Gateway (green routing) before reaching any LLM backend. Every request is logged to SQLite telemetry and visualized in a C-level Streamlit Command Center — all served from **one port**.

---

## Twin-Pillar Architecture

### NexusShield — Enterprise AI Security & Privacy Guardrail

| Capability | Description |
|------------|-------------|
| **PII/PHI Anonymization** | Regex-based redaction of emails, phone numbers, and credit card patterns before upstream forwarding |
| **Prompt Injection Defense** | Heuristic detection and HTTP 400 rejection of adversarial override attempts |
| **Contextual Guardrails** | Sanitizes all message roles (user, system, assistant) including multimodal text parts |
| **DLP & Policy Enforcement** | Blocks high-risk payloads at the edge; logs every redaction and threat to SQLite audit trail |
| **OpenAI Compatibility** | Drop-in replacement for `/v1/chat/completions` — zero client SDK changes |

### ResoNet Gateway — Resource-Aware Green AI & Sustainability Engine

| Capability | Description |
|------------|-------------|
| **Semantic Token Compression** | Strips filler phrases and redundant whitespace to reduce input token count |
| **Thermodynamic Smart Routing** | Routes simple tasks to local **Ollama**; complex workloads to cloud providers |
| **Real-Time ESG Metrics** | Calculates water (mL) and energy (Wh) savings per request; injects response headers |
| **FinOps Offloading** | 60–70% of routine Q&A can run on local inference — eliminating cloud token charges entirely |
| **Telemetry Persistence** | Every route decision, token estimate, and sustainability coefficient logged to SQLite |

---

## Architecture Diagram

```
                         ┌─────────────────────────────────────────────────────────┐
                         │              AI Enterprise Stack (:8080)                  │
  Client / Agent SDK     │                                                         │
  (OpenAI-compatible)    │   ┌──────────────────┐    ┌──────────────────────┐   │
        │                │   │   NexusShield    │    │   ResoNet Gateway    │   │
        │  POST /nexus/  │   │  PII Masking     │    │  Prompt Compression  │   │
        ├───────────────►│   │  Injection Block │    │  Smart Router        │   │
        │                │   └────────┬─────────┘    └──────────┬───────────┘   │
        │  POST /resonet/           │                           │               │
        ├──────────────────────────►│                           │               │
        │                           ▼                           ▼               │
        │                  ┌────────────────────────────────────────────┐       │
        │                  │         SQLite Telemetry (data/telemetry.db)│       │
        │                  │  module | route | status | water | energy  │       │
        │                  └────────────────────┬───────────────────────┘       │
        │                                       │                               │
        │  GET /dashboard/                      ▼                               │
        └──────────────────────────────────►┌──────────────────┐              │
                                             │ Streamlit Command │              │
                                             │ Center (internal  │              │
                                             │ :8501 → proxy)    │              │
                                             └──────────────────┘              │
                         └─────────────────────────────────────────────────────────┘
                                              │                    │
                              ┌───────────────┘                    └────────────────┐
                              ▼                                                     ▼
                   ┌─────────────────────┐                            ┌─────────────────────┐
                   │  Ollama (Local)     │                            │  Cloud LLM Provider │
                   │  host:11434 / remote│                            │  OpenAI-compatible  │
                   │  Zero water cost    │                            │  GPT-4o / Azure / … │
                   └─────────────────────┘                            └─────────────────────┘
```

### Request Flow

1. **Ingress** — Client sends OpenAI-format JSON to `/nexus/v1/chat/completions` or `/resonet/v1/chat/completions`.
2. **Guard / Compress** — NexusShield masks PII and blocks injections; ResoNet compresses prompts and selects a route.
3. **Forward** — Sanitized payload proxied asynchronously via `httpx` to Ollama or cloud API.
4. **Telemetry** — Metrics written to SQLite (`water_saved_ml`, `energy_saved_wh`, `redactions_count`, `route`, `status_code`).
5. **Observability** — Streamlit dashboard reads live telemetry at `/dashboard/`.

---

## Local Architecture (Recommended)

Run **two processes** in separate terminals — no WebSocket reverse-proxy complexity:

| Service | Port | Command |
|---------|------|---------|
| **API Gateway** (FastAPI) | `8080` | `scripts/run_api.ps1` or `uvicorn app.main:app --port 8080` |
| **Command Center** (Streamlit) | `8501` | `scripts/run_dashboard.ps1` or `streamlit run app/dashboard.py` |

Both share the same SQLite telemetry file (`data/telemetry.db`). Streamlit reads live metrics written by the API proxies.

```
Terminal 1 → API + Telemetri     http://localhost:8080
Terminal 2 → Command Center      http://localhost:8501
```

Set `STREAMLIT_ENABLED=false` (default) so FastAPI does **not** embed Streamlit behind `/dashboard`.

---

## Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `http://localhost:8080/healthz` | GET | Liveness probe |
| `http://localhost:8080/docs` | GET | Interactive OpenAPI (Swagger UI) |
| `http://localhost:8080/nexus/v1/chat/completions` | POST | NexusShield security proxy |
| `http://localhost:8080/resonet/v1/chat/completions` | POST | ResoNet green AI proxy |
| `http://localhost:8501` | GET | **Command Center** (Streamlit, recommended) |
| `http://localhost:8080/dashboard/` | GET | Command Center via proxy (Docker / `STREAMLIT_ENABLED=true` only) |

### Response Headers

**NexusShield:** `X-NexusShield-Redactions`

**ResoNet:**

| Header | Formula / Value |
|--------|-----------------|
| `X-Resonet-Tokens-Saved` | Compressed token delta |
| `X-Resonet-Water-Saved-mL` | `saved_tokens × 0.002` |
| `X-Resonet-Energy-Saved-Wh` | `saved_tokens × 0.0003` |
| `X-Resonet-Route-Used` | `ollama-local` or `cloud-provider` |

---

## Enterprise Installer (Single Command)

| Platform | Command |
|----------|---------|
| **Windows** | `powershell -ExecutionPolicy Bypass -File .\scripts\setup.ps1` |
| **Linux / macOS** | `chmod +x ./scripts/setup.sh && ./scripts/setup.sh` |

Full production guide: **[DEPLOYMENT.md](DEPLOYMENT.md)**

---

## Quickstart

### Option A — Docker Compose (Recommended for Production)

**Prerequisites:** Docker 24+, Docker Compose v2, Ollama running on the host (`ollama serve`).

```bash
cd ai-enterprise-stack

# Configure secrets
cp .env.example .env
# Edit .env and set OPENAI_API_KEY

# Build and start
docker compose up -d --build

# Verify
curl http://localhost:8080/healthz
curl -I http://localhost:8080/dashboard/
```

**Ollama connectivity from container:**

- Default: `OLLAMA_BASE_URL=http://host.docker.internal:11434/v1`
- `extra_hosts: host.docker.internal:host-gateway` is pre-configured in `docker-compose.yml`
- For remote Ollama: set `OLLAMA_BASE_URL=http://your-ollama-host:11434/v1`

**Persistent telemetry:**

```yaml
volumes:
  - ./data:/app/data   # SQLite telemetry.db survives container restarts
```

**Logs & lifecycle:**

```bash
docker compose logs -f ai-gateway
docker compose down          # stop
docker compose up -d         # restart
```

### Option B — Native Python (Development, Recommended Layout)

**Terminal 1 — API Gateway:**

```powershell
cd ai-enterprise-stack
.venv\Scripts\activate          # or: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env            # set OPENAI_API_KEY, STREAMLIT_ENABLED=false

powershell -ExecutionPolicy Bypass -File scripts\run_api.ps1
# → http://localhost:8080
```

**Terminal 2 — Command Center:**

```powershell
cd ai-enterprise-stack
.venv\Scripts\activate
powershell -ExecutionPolicy Bypass -File scripts\run_dashboard.ps1
# → http://localhost:8501
```

**Run integration tests:**

```powershell
# Windows
powershell -ExecutionPolicy Bypass -File tests\run_tests.ps1
```

---

## Configuration Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENAI_API_KEY` | — | Cloud LLM API key |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | Cloud OpenAI-compatible base URL |
| `DEFAULT_MODEL` | `gpt-4o-mini` | Default cloud model |
| `OLLAMA_BASE_URL` | `http://localhost:11434/v1` (native) / `host.docker.internal` (Docker) | Ollama endpoint |
| `OLLAMA_MODEL` | `llama3.2` | Local model for simple tasks |
| `RESONET_SIMPLE_CHAR_THRESHOLD` | `100` | Character limit for local routing |
| `NEXUS_INJECTION_BLOCK` | `true` | Reject injection-pattern prompts |
| `TELEMETRY_DB_PATH` | `data/telemetry.db` | SQLite telemetry database |
| `STREAMLIT_ENABLED` | `false` | `false` = Streamlit on `:8501` (recommended); `true` = proxy at `/dashboard/` |
| `WATER_ML_PER_TOKEN` | `0.002` | ESG water coefficient |
| `ENERGY_WH_PER_TOKEN` | `0.0003` | ESG energy coefficient |

Module-specific overrides: `NEXUS_UPSTREAM_URL`, `NEXUS_UPSTREAM_API_KEY`, `RESONET_CLOUD_BASE_URL`, `RESONET_CLOUD_API_KEY`.

---

## Enterprise Pitch Deck (C-Level Brief)

Use the following slide structure for investor, CISO, and CTO presentations.

---

### Slide 1 — Title

**AI Enterprise Stack: Secure, Sustainable AI Infrastructure**

*One gateway. Two pillars. Zero compromise on governance or ESG.*

---

### Slide 2 — The Problem

| Risk Domain | Enterprise Pain |
|-------------|-----------------|
| **Security** | 73% of orgs lack AI-specific DLP; prompt injection is the #1 LLM attack vector (OWASP LLM Top 10) |
| **Compliance** | GDPR Art. 32 / HIPAA §164.312 require demonstrable controls over PHI/PII in AI pipelines |
| **Sustainability** | A single GPT-4 query can consume ~14× the energy of a Google search; ESG auditors demand measurable AI footprint |
| **FinOps** | Cloud LLM token costs scale linearly with adoption — without routing intelligence, 60%+ of queries are over-provisioned |

---

### Slide 3 — The Solution: Twin-Pillar Architecture

```
NexusShield (Security)  +  ResoNet Gateway (Sustainability)  =  Unified AI Proxy
```

- **Drop-in OpenAI compatibility** — no application rewrites
- **Edge enforcement** — policies applied before data leaves your perimeter
- **Live telemetry** — every decision auditable in SQLite + Streamlit Command Center

---

### Slide 4 — NexusShield: Risk Mitigation

| Control | Business Outcome |
|---------|------------------|
| PII/PHI anonymization | Prevents regulatory breach notifications |
| Injection blocking | Stops adversarial jailbreaks at the API edge |
| Audit logging | ISO 27001 / SOC 2 evidence trail |
| Policy enforcement | Corporate DLP rules applied uniformly across all AI clients |

**Value proposition for CISO:** *Reduce AI attack surface to a single governed chokepoint.*

---

### Slide 5 — ResoNet Gateway: ESG & FinOps

| Capability | Business Outcome |
|------------|------------------|
| Ollama local routing | Zero cloud cost + zero data-center water for simple queries |
| Semantic compression | 5–15% input token reduction on verbose prompts |
| Water/Energy headers | Real-time ESG KPIs for CSRD / SEC climate disclosure |
| Route telemetry | Prove sustainability claims with auditable SQLite records |

**Value proposition for CFO / CSO:** *Quantify AI's thermodynamic cost and eliminate unnecessary cloud spend.*

---

### Slide 6 — ROI & Offloading Math

**Assumptions (mid-size enterprise, 10,000 AI requests/day):**

| Parameter | Value |
|-----------|-------|
| Daily requests | 10,000 |
| Local offload rate (ResoNet) | **65%** |
| Avg. cloud tokens/request (offloaded) | 500 |
| Cloud cost | $0.003 / 1K tokens |
| Local cost (Ollama, amortized hardware) | ~$0.000 / request |

**Monthly savings calculation:**

```
Offloaded requests  = 10,000 × 0.65 × 30 = 195,000 req/month
Tokens not billed   = 195,000 × 500       = 97.5M tokens/month
Cloud cost avoided  = 97,500 × $0.003     = $292.50/month (direct token savings)

Remaining cloud     = 35% × 10,000 × 30  = 105,000 req/month
Compression savings = ~10% input tokens   = additional ~$15/month

Total direct savings ≈ $300+/month at 10K req/day
Annual run-rate      ≈ $3,600+ (scales linearly with adoption)
At 100K req/day      ≈ $36,000+/year cloud token reduction
```

**ESG impact (same scenario):**

```
Saved input tokens (compression, 10% avg)  ≈ 4.9M tokens/month
Water saved   = 4.9M × 0.002 mL  ≈ 9.8 L/month
Energy saved  = 4.9M × 0.0003 Wh ≈ 1.47 kWh/month
(Local offload eliminates 100% of cloud water/energy for 65% of requests)
```

---

### Slide 7 — Deployment & Time-to-Value

| Milestone | Timeline |
|-----------|----------|
| `docker compose up -d` | **< 5 minutes** |
| First secured + routed inference | **< 10 minutes** |
| Dashboard live at `/dashboard/` | Automatic on startup |
| Full telemetry audit trail | Immediate (SQLite) |

**Deployment options:** Docker Compose (on-prem / VPC), native Python (dev), behind nginx/Traefik with TLS.

---

### Slide 8 — Competitive Differentiation

| Feature | Generic API Gateway | AI Enterprise Stack |
|---------|--------------------|--------------------|
| PII masking | ❌ | ✅ NexusShield |
| Prompt injection defense | ❌ | ✅ NexusShield |
| Local/cloud smart routing | ❌ | ✅ ResoNet |
| ESG water/energy metrics | ❌ | ✅ ResoNet |
| Unified C-level dashboard | ❌ | ✅ Streamlit Command Center |
| OpenAI drop-in compatibility | Partial | ✅ Full |

---

### Slide 9 — Call to Action

1. **Pilot** — Deploy via Docker Compose against existing Ollama + OpenAI keys.
2. **Measure** — Review 30-day telemetry: offload ratio, threats blocked, ESG savings.
3. **Scale** — Integrate as the single AI egress point for all internal agents and applications.

**Contact your platform team to schedule a 2-week proof-of-concept.**

---

## Project Structure

```
ai-enterprise-stack/
├── app/
│   ├── main.py                     # FastAPI entrypoint + Streamlit mount
│   ├── dashboard.py                # Enterprise Command Center (Streamlit)
│   ├── core/
│   │   ├── config.py               # Pydantic Settings
│   │   ├── db.py                   # SQLite telemetry
│   │   ├── metrics.py              # Water / energy / carbon calculations
│   │   └── streamlit_mount.py      # Subprocess + reverse proxy
│   ├── nexusshield/
│   │   ├── guard.py                # PII redaction & injection heuristics
│   │   └── router.py               # /nexus/v1/chat/completions
│   └── resonet/
│       ├── compressor.py           # Prompt trimming
│       ├── router_engine.py        # Ollama vs cloud routing
│       └── router.py               # /resonet/v1/chat/completions
├── data/                           # SQLite telemetry (gitignored, Docker volume)
├── tests/                          # Integration test payloads & scripts
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
└── README.md
```

---

## Production Hardening Checklist

- [ ] Terminate TLS at nginx / Traefik / cloud load balancer
- [ ] Store `OPENAI_API_KEY` in a secrets manager (not plain `.env` in production)
- [ ] Restrict `/dashboard/` to internal network or SSO-protected reverse proxy
- [ ] Back up `./data/telemetry.db` on a schedule
- [ ] Set resource limits in `docker-compose.yml` (`mem_limit`, `cpus`)
- [ ] Pin Docker image tags in CI/CD (`:sha` not `:latest`)
- [ ] Replace token heuristic with `tiktoken` for billing-grade accuracy

---

## License

Proprietary — Enterprise AI Infrastructure Platform.
