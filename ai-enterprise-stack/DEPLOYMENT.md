# AI Enterprise Stack — Enterprise Deployment Guide

Production reference for provisioning **NexusShield** and **ResoNet Gateway** on client infrastructure using the Enterprise Installer automation suite.

---

## Hardware & OS Prerequisites

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| vCPU | 2 | 4+ |
| RAM | 4 GB | 8 GB+ |
| Disk | 10 GB free | 20 GB+ (Docker images + SQLite + logs) |
| Network | Outbound HTTPS (cloud LLM) | Low-latency link to Ollama host |

### Supported Operating Systems

| Platform | Versions |
|----------|----------|
| **Ubuntu** | 22.04 LTS, 24.04 LTS |
| **RHEL / Rocky / Alma** | 8.x, 9.x |
| **macOS** | 12+ (Docker Desktop) |
| **Windows** | 10/11 Pro, Windows Server 2022+ (Docker Desktop or Engine) |

### Software Prerequisites

| Component | Purpose | Install |
|-----------|---------|---------|
| **Docker Engine** | Container runtime | [Linux](https://docs.docker.com/engine/install/) / [Desktop](https://docs.docker.com/desktop/) |
| **Docker Compose v2** | Orchestration | Bundled with Docker Desktop / `docker compose` plugin |
| **Ollama** (optional) | ResoNet local routing | [ollama.com](https://ollama.com/) on **host** machine |
| **curl** (Linux/macOS) | Health checks in installer | Pre-installed on most distros |

---

## Single-Command Quickstart

### Windows (PowerShell)

```powershell
cd C:\path\to\ai-enterprise-stack
powershell -ExecutionPolicy Bypass -File .\scripts\setup.ps1
```

**Non-interactive** (CI / golden image):

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup.ps1 -NonInteractive
```

### Linux / macOS (Bash)

```bash
cd /path/to/ai-enterprise-stack
chmod +x ./scripts/setup.sh
./scripts/setup.sh
```

**Non-interactive:**

```bash
./scripts/setup.sh --non-interactive
```

### What the Installer Does

1. Validates Docker daemon connectivity (`docker info`)
2. Checks Ollama availability (warns if missing)
3. Creates `.env` from `.env.example` **only if missing** — never overwrites existing production configs
4. Interactively prompts for `OPENAI_API_KEY`, `GRID_CARBON_REGION`, `RESONET_COMPRESSION_TOKEN_THRESHOLD`
5. Creates `./data` with write-permission verification (SQLite persistence)
6. Runs `docker compose up -d --build`
7. Polls `http://localhost:8080/healthz` for up to 30 seconds

---

## Service Endpoints (Post-Deploy)

| Service | URL |
|---------|-----|
| Health | http://localhost:8080/healthz |
| API Docs | http://localhost:8080/docs |
| NexusShield | http://localhost:8080/nexus/v1/chat/completions |
| ResoNet | http://localhost:8080/resonet/v1/chat/completions |
| Command Center (Docker) | http://localhost:8080/dashboard/ |
| Command Center (native dev) | http://localhost:8501 |

### Native Dual-Port Development (Optional)

For maximum Streamlit stability without reverse-proxy WebSockets:

```powershell
# Terminal 1
powershell -File scripts\run_api.ps1

# Terminal 2
powershell -File scripts\run_dashboard.ps1
```

Set `STREAMLIT_ENABLED=false` in `.env` for this layout.

---

## Architecture Overview

```
                    ┌─────────────────────────────────────┐
  Client SDKs  ───► │  ai-gateway container (:8080)       │
                    │  ├─ NexusShield  /nexus/v1          │
                    │  ├─ ResoNet      /resonet/v1         │
                    │  ├─ Dashboard    /dashboard/        │
                    │  └─ SQLite WAL   /app/data/         │
                    └──────────────┬──────────────────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              ▼                    ▼                    ▼
     host.docker.internal    OpenAI / Groq         ./data volume
     Ollama :11434           Cloud LLM API         telemetry.db
```

---

## Production Hardening Checklist

### SQLite WAL Mode & Backups

WAL mode is enabled automatically at startup (`app/core/db.py`):

```sql
PRAGMA journal_mode=WAL;
PRAGMA synchronous=NORMAL;
PRAGMA busy_timeout=5000;
```

**Backup strategy:**

```bash
# Hot backup (safe while container runs)
sqlite3 data/telemetry.db ".backup 'backups/telemetry-$(date +%F).db'"

# Cron example (daily 02:00 UTC)
0 2 * * * cd /opt/ai-enterprise-stack && sqlite3 data/telemetry.db ".backup 'backups/telemetry-$(date +\%F).db'"
```

Retain backups off-host (S3, Azure Blob, NFS) for compliance audit trails.

### Reverse Proxy — TLS Termination (Nginx)

Place Nginx in front of the gateway; do **not** expose `:8080` publicly without TLS.

```nginx
upstream ai_enterprise_stack {
    server 127.0.0.1:8080;
    keepalive 32;
}

server {
    listen 443 ssl http2;
    server_name ai-gateway.corp.example.com;

    ssl_certificate     /etc/ssl/certs/ai-gateway.crt;
    ssl_certificate_key /etc/ssl/private/ai-gateway.key;

    client_max_body_size 20m;

    location / {
        proxy_pass http://ai_enterprise_stack;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Streamlit WebSocket support (single-port dashboard)
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400;
    }
}
```

### Traefik (Alternative)

```yaml
# docker-compose overlay snippet
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.ai-gateway.rule=Host(`ai-gateway.corp.example.com`)"
  - "traefik.http.routers.ai-gateway.entrypoints=websecure"
  - "traefik.http.routers.ai-gateway.tls.certresolver=letsencrypt"
```

### Secret Management & Rotation

| Secret | Storage | Rotation |
|--------|---------|----------|
| `OPENAI_API_KEY` | Vault / AWS SM / Azure KV | 90-day policy |
| `.env` file | **Never commit to git** | Rotate via installer-safe manual edit |
| SQLite DB | Encrypted volume at rest | N/A |

**Rotation procedure:**

1. Issue new API key in provider console
2. Update `.env` → `OPENAI_API_KEY`
3. `docker compose up -d` (recreates env injection)
4. Revoke old key

Use `--env-file /run/secrets/ai_gateway.env` in production instead of plain `.env` on disk where supported.

### Container Healthchecks & Log Rotation

Healthcheck is defined in `docker-compose.yml` (90s start period for Streamlit subprocess).

**Log rotation** (Docker daemon `/etc/docker/daemon.json`):

```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "50m",
    "max-file": "5"
  }
}
```

**Monitor:**

```bash
docker compose ps
docker inspect ai-enterprise-gateway --format='{{.State.Health.Status}}'
docker compose logs --tail=100 ai-gateway
```

---

## Environment Variables Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENAI_API_KEY` | — | Cloud LLM credential |
| `OLLAMA_BASE_URL` | `http://host.docker.internal:11434/v1` | Host Ollama from container |
| `STREAMLIT_ENABLED` | `true` (Docker installer) | Proxy dashboard at `/dashboard/` |
| `GRID_CARBON_REGION` | `global` | Carbon intensity region code |
| `RESONET_COMPRESSION_TOKEN_THRESHOLD` | `200` | Semantic compression threshold |
| `NEXUS_OUTPUT_GUARD_ENABLED` | `true` | LLM output PII scanning |
| `TELEMETRY_DB_PATH` | `/app/data/telemetry.db` | SQLite path inside container |

---

## Load Testing (PoC / Pilot)

```bash
pip install locust
locust -f tests/locustfile.py --host http://localhost:8080 \
  --users 50 --spawn-rate 10 --run-time 2m --headless \
  --csv=tests/load_results
```

Review `tests/load_results_stats.csv` for **p50 / p95 / p99** latency and RPS.

---

## Troubleshooting Matrix

| Symptom | Likely Cause | Resolution |
|---------|--------------|------------|
| `Port 8080 already in use` | Conflicting service | `netstat -ano \| findstr 8080` (Windows) / `ss -tlnp \| grep 8080` (Linux); stop conflicting process or change compose port mapping |
| `Port 8501 already in use` | Standalone Streamlit running | Stop native dashboard: `scripts/run_dashboard.*` or change Streamlit port |
| `Connection refused` to Ollama from container | Ollama not running on host | `ollama serve` on host; verify `curl http://localhost:11434/api/tags` |
| `host.docker.internal` fails on Linux | Missing extra_hosts | Already configured in `docker-compose.yml`; ensure Docker ≥ 20.10 |
| `502 upstream_unreachable` (ResoNet) | Ollama down or wrong URL | Set `OLLAMA_BASE_URL=http://host.docker.internal:11434/v1` |
| `429 credit_balance_exhausted` | OpenAI billing | Add credits; key is valid but quota exhausted |
| `SQLite database is locked` | Concurrent writes without WAL | Confirm WAL enabled; restart container; avoid copying DB while writing |
| `./data permission denied` | Volume mount ownership | `chmod 775 data` (Linux) / grant Users write ACL (Windows) |
| Dashboard skeleton loader stuck | WebSocket proxy issue | Use dual-port: `STREAMLIT_ENABLED=false` + `scripts/run_dashboard.*` on `:8501` |
| `docker compose build` fails | Network / disk | Check Docker disk space; retry with `docker compose build --no-cache` |
| Health check timeout (30s) | Slow first boot / ML deps | Wait 90s; check `docker compose logs ai-gateway` |
| `.env` not applied | Cached container env | `docker compose down && docker compose up -d --build` |

---

## Operational Commands

```bash
# Start
docker compose up -d --build

# Stop
docker compose down

# Restart after config change
docker compose up -d

# Shell into container
docker exec -it ai-enterprise-gateway bash

# Tail logs
docker compose logs -f ai-gateway

# Verify health
curl http://localhost:8080/healthz
```

---

## Uninstall

```bash
docker compose down
docker rmi ai-enterprise-stack-ai-gateway 2>/dev/null || true
# Optional: remove telemetry
# rm -rf data/telemetry.db*
```

---

## Support Escalation Path

1. Collect: `docker compose logs ai-gateway > gateway.log`
2. Collect: `curl -v http://localhost:8080/healthz`
3. Verify: `.env` redacted copy (no secrets)
4. Attach: Locust CSV if performance-related

---

*AI Enterprise Stack — Enterprise Infrastructure Team*
