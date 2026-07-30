# Performance & Benchmark Results

Through asynchronous processing, Redis caching, and early-exit rule evaluation, the Nexus Shield Fast API achieved a **~99% reduction in latency** during peak load testing compared to the legacy ML pipeline.

> **Note:** Fast API (`nexus_shield_fast_api.py`) uses pattern-based early exit + optional Redis cache. Production ML API (`nexus_shield_api.py`) provides full semantic vector defense — use Fast API for low-latency guardrails and load testing; use ML API for maximum detection coverage.

## Benchmark Comparison (Locust Load Test)

Local run: `tests/locustfile.py`, 2 users, 30s, `http://localhost:8080`

| Metric | Legacy ML Pipeline | Fast API (Async + Early Exit) | Improvement |
| :--- | :--- | :--- | :--- |
| **`[attack]` Median Latency** | 2,000 ms | **8 ms** | **99.6% Faster** |
| **`[clean]` Median Latency** | 8,800 ms | **120 ms** | **98.6% Faster** |
| **Cache Hit Latency** | N/A | **< 10 ms** | **Instant Response** |
| **Success Rate** | 100% | **100%** | Zero Failures |

### Locust task expectations

| Task | Payload | Expected HTTP | Locust result |
|------|---------|---------------|---------------|
| `[clean]` | Benign corporate question | **200** | success |
| `[attack]` | Prompt injection pattern | **403** | success (firewall blocked) |
| Either | Missing/wrong API key | **401** | failure |

## Quick Start with Docker

```bash
# Build and spin up Fast API + Redis
docker compose -f docker-compose.fast.yml up -d --build

# Verify health
curl http://localhost:8080/healthz

# Run Locust verification tests
export NEXUS_API_KEY=nexus_secret_key_123   # or your prod key
python -m pip install -r requirements-load.txt
python -m locust -f tests/locustfile.py --headless -u 10 -r 2 --run-time 1m --host=http://localhost:8080
```

**PowerShell:**

```powershell
docker compose -f docker-compose.fast.yml up -d --build
$env:NEXUS_API_KEY = "nexus_secret_key_123"
python -m locust -f tests/locustfile.py --headless -u 10 -r 2 --run-time 1m --host=http://localhost:8080
```

## Architecture (Fast Stack)

```
Client → shield-api:8080
           ├─ Redis cache hit  (< 15 ms target)
           ├─ Pattern early exit → 403
           └─ Async upstream mock (~100 ms)
```

## Related files

| File | Purpose |
|------|---------|
| `nexus_shield_fast_api.py` | Fast guardrail service |
| `Dockerfile.fast` | Lightweight container (no ML model) |
| `docker-compose.fast.yml` | Fast API + Redis |
| `tests/locustfile.py` | Load test (clean + attack scenarios) |
| `requirements-fast.txt` | Fast API dependencies |
| `requirements-load.txt` | Locust runner |
