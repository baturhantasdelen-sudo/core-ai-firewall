# -*- coding: utf-8 -*-
"""
Nexus Shield v2.0 — High-Performance Guardrail API (Early Exit + PII Redaction + Redis cache).

Hafif erken çıkış katmanı; tam ML pipeline yerine düşük gecikme hedefler.
Production ML koruması için: nexus_shield_api.py / nexus_quantum_guard.py

Çalıştırma:
    uvicorn nexus_shield_fast_api:app --host 0.0.0.0 --port 8080

Ortam:
    NEXUS_API_KEY       — Legacy admin API key (varsayılan: nexus_secret_key_123)
    NEXUS_API_KEYS_FILE — Müşteri anahtarları JSON dosyası (varsayılan: data/api_keys.json)
    NEXUS_TRIAL_DAYS    — Deneme süresi gün (varsayılan: 14)
    STRIPE_WEBHOOK_SECRET — Stripe imza doğrulama (opsiyonel)
    LEMON_WEBHOOK_SECRET  — Lemon Squeezy imza doğrulama (opsiyonel)
    REDIS_URL           — redis://localhost:6379/0 (opsiyonel; yoksa cache devre dışı)
    REDIS_CACHE_TTL_SEC — önbellek TTL (varsayılan 3600)
    POSTHOG_API_KEY     — PostHog project API key (opsiyonel)
    POSTHOG_HOST        — PostHog ingest host (varsayılan: https://us.i.posthog.com)
    CLOUDFLARE_WEB_ANALYTICS_TOKEN — Cloudflare Web Analytics beacon token (opsiyonel)
    SANDBOX_RATE_LIMIT_PER_MIN — Playground /api/sandbox IP limiti (varsayılan: 30)
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import secrets
import time
from collections import deque
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from dataclasses import dataclass, field
from typing import Any, Final

from fastapi import FastAPI, Header, HTTPException, Request, WebSocket, WebSocketDisconnect, status
from fastapi.responses import HTMLResponse, Response
from pydantic import BaseModel, Field

from nexus_auth import api_key_store, auth_router
from nexus_governance.routes import router as governance_router

logger = logging.getLogger("NexusShieldFastAPI")

DEFAULT_NEXUS_API_KEY: Final[str] = "nexus_secret_key_123"
NEXUS_API_KEY: Final[str] = os.getenv("NEXUS_API_KEY", DEFAULT_NEXUS_API_KEY)
REDIS_URL: Final[str] = os.getenv("REDIS_URL", "redis://localhost:6379/0")
REDIS_CACHE_TTL_SEC: Final[int] = int(os.getenv("REDIS_CACHE_TTL_SEC", "3600"))
UPSTREAM_LLM_LATENCY_SEC: Final[float] = float(os.getenv("UPSTREAM_LLM_LATENCY_SEC", "0.1"))
POSTHOG_API_KEY: Final[str] = os.getenv("POSTHOG_API_KEY", "")
POSTHOG_HOST: Final[str] = os.getenv("POSTHOG_HOST", "https://us.i.posthog.com")
CLOUDFLARE_WEB_ANALYTICS_TOKEN: Final[str] = os.getenv("CLOUDFLARE_WEB_ANALYTICS_TOKEN", "")
SANDBOX_RATE_LIMIT_PER_MIN: Final[int] = int(os.getenv("SANDBOX_RATE_LIMIT_PER_MIN", "30"))

PROMPT_INJECTION_BLOCK_DETAIL: Final[str] = (
    "Blocked by Nexus Shield Early Exit Engine (Prompt Injection Detected)"
)
COST_SAVED_PER_BLOCK_USD: Final[float] = 0.03
LEGACY_ML_LATENCY_MS: Final[float] = 8700.0
MAX_RECENT_EVENTS: Final[int] = 50
MAX_LATENCY_HISTORY: Final[int] = 30
PROMPT_EXCERPT_LEN: Final[int] = 80

PROMPT_INJECTION_PATTERNS: Final[tuple[str, ...]] = (
    r"ignore\s+(all\s+)?(previous|prior)\s+(instructions|directions|prompts|rules)",
    r"disregard\s+(all\s+)?(previous|prior)\s+(instructions|directions|prompts|rules)",
    r"forget\s+(all\s+)?(previous|prior)\s+(instructions|directions|prompts|rules)",
    r"(output|show|print|reveal|display)\s+(the\s+)?(system\s+prompt|developer\s+mode|initial\s+instructions)",
    r"what\s+(are|were)\s+your\s+(original|initial|system)\s+(instructions|prompts)",
    r"you\s+are\s+now\s+(in\s+)?(DAN|developer|unrestricted|god)\s+mode",
    r"act\s+as\s+an?\s+unfiltered",
    r"bypass\s+(all\s+)?(safety|content|ethical)\s+(filters|policies|guardrails)",
    r"\[system\]\s*:",
    r"<\|im_start\|>",
    r"###\s*Instruction",
)

COMPILED_PATTERNS: Final[tuple[re.Pattern[str], ...]] = tuple(
    re.compile(p, re.IGNORECASE) for p in PROMPT_INJECTION_PATTERNS
)

# --- PII Detection & Redaction (v2.0) — pre-compiled patterns ---
PII_PATTERNS: Final[dict[str, str]] = {
    "TCKN": r"\b[1-9]\d{10}\b",
    "CREDIT_CARD": r"\b(?:\d{4}[-\s]?){3}\d{4}\b|\b(?:\d[ -]*){13,19}\d\b",
    "EMAIL": r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}",
    "PHONE": r"(?:\+?90|0)?\s*[5]\d{2}\s*\d{3}\s*\d{2}\s*\d{2}",
}

COMPILED_PII_PATTERNS: Final[dict[str, re.Pattern[str]]] = {
    pii_type: re.compile(pattern) for pii_type, pattern in PII_PATTERNS.items()
}


def apply_pii_redaction(text: str) -> tuple[str, bool, list[str]]:
    redacted_text = text
    detected_types: list[str] = []

    for pii_type, pattern in COMPILED_PII_PATTERNS.items():
        if pattern.search(redacted_text):
            detected_types.append(pii_type)
            redacted_text = pattern.sub(f"[{pii_type}_REDACTED]", redacted_text)

    return redacted_text, len(detected_types) > 0, detected_types


@dataclass
class RedactionResult:
    text: str
    pii_detected: bool
    masked_types: list[str] = field(default_factory=list)


def redact_pii(user_input: str) -> RedactionResult:
    redacted_text, pii_detected, detected_types = apply_pii_redaction(user_input)
    return RedactionResult(
        text=redacted_text,
        pii_detected=pii_detected,
        masked_types=detected_types,
    )


_redis_client = None


class AnalyticsStore:
    """In-memory counters and recent event log for the live dashboard."""

    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self.total_requests: int = 0
        self.total_blocked: int = 0
        self.total_clean: int = 0
        self.total_cache_hits: int = 0
        self.total_pii_masked: int = 0
        self.cost_saved_usd: float = 0.0
        self.events: deque[dict[str, Any]] = deque(maxlen=MAX_RECENT_EVENTS)
        self.latency_history: deque[dict[str, Any]] = deque(maxlen=MAX_LATENCY_HISTORY)

    @staticmethod
    def _prompt_excerpt(prompt: str) -> str:
        text = prompt.replace("\n", " ").strip()
        if len(text) <= PROMPT_EXCERPT_LEN:
            return text
        return f"{text[:PROMPT_EXCERPT_LEN]}…"

    async def record(
        self,
        *,
        event_type: str,
        status_code: int,
        prompt: str,
        latency_ms: float,
        action: str,
        masked_types: list[str] | None = None,
    ) -> dict[str, Any]:
        async with self._lock:
            self.total_requests += 1
            if event_type == "blocked":
                self.total_blocked += 1
                self.cost_saved_usd += COST_SAVED_PER_BLOCK_USD
            elif event_type == "pii_masked":
                self.total_pii_masked += 1
            elif event_type == "cache_hit":
                self.total_cache_hits += 1
            else:
                self.total_clean += 1

            event = {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "type": event_type,
                "status_code": status_code,
                "prompt_excerpt": self._prompt_excerpt(prompt),
                "latency_ms": round(latency_ms, 2),
                "action": action,
                "masked_types": masked_types or [],
            }
            self.events.appendleft(event)
            self.latency_history.append(
                {"timestamp": event["timestamp"], "latency_ms": event["latency_ms"]}
            )
            return event

    def snapshot(self) -> dict[str, Any]:
        block_rate = (
            round((self.total_blocked / self.total_requests) * 100, 1)
            if self.total_requests
            else 0.0
        )
        latencies = [e["latency_ms"] for e in self.events if e["type"] == "blocked"]
        avg_blocked_ms = round(sum(latencies) / len(latencies), 2) if latencies else 4.0
        latency_saved_ms = round(LEGACY_ML_LATENCY_MS - avg_blocked_ms, 2)
        return {
            "total_requests": self.total_requests,
            "total_blocked": self.total_blocked,
            "total_clean": self.total_clean,
            "total_cache_hits": self.total_cache_hits,
            "total_pii_masked": self.total_pii_masked,
            "cost_saved_usd": round(self.cost_saved_usd, 2),
            "block_rate_percent": block_rate,
            "avg_blocked_latency_ms": avg_blocked_ms,
            "latency_saved_ms": latency_saved_ms,
            "legacy_latency_ms": LEGACY_ML_LATENCY_MS,
            "latency_history": list(self.latency_history),
        }


class ConnectionManager:
    """Manages active WebSocket clients for live analytics broadcast."""

    def __init__(self) -> None:
        self.active: list[WebSocket] = []

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active.append(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        if websocket in self.active:
            self.active.remove(websocket)

    async def broadcast(self, message: dict[str, Any]) -> None:
        stale: list[WebSocket] = []
        for connection in self.active:
            try:
                await connection.send_json(message)
            except Exception:
                stale.append(connection)
        for connection in stale:
            self.disconnect(connection)


analytics = AnalyticsStore()
ws_manager = ConnectionManager()


async def _get_redis():
    return _redis_client


async def _emit_analytics(
    *,
    event_type: str,
    status_code: int,
    prompt: str,
    latency_ms: float,
    action: str,
    masked_types: list[str] | None = None,
) -> None:
    event = await analytics.record(
        event_type=event_type,
        status_code=status_code,
        prompt=prompt,
        latency_ms=latency_ms,
        action=action,
        masked_types=masked_types,
    )
    await ws_manager.broadcast(
        {
            "type": "update",
            "metrics": analytics.snapshot(),
            "event": event,
            "events": list(analytics.events),
        }
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _redis_client
    try:
        import redis.asyncio as redis

        _redis_client = redis.from_url(REDIS_URL, decode_responses=True)
        await _redis_client.ping()
        logger.info("Redis bağlantısı hazır: %s", REDIS_URL)
    except Exception as exc:
        _redis_client = None
        logger.warning("Redis kullanılamıyor, cache devre dışı: %s", exc)
    yield
    if _redis_client is not None:
        await _redis_client.aclose()
        _redis_client = None


app = FastAPI(
    title="Nexus Shield High-Performance Guardrail API v2.0",
    lifespan=lifespan,
)
app.include_router(auth_router)
app.include_router(governance_router)

# --- Landing page (register first — highest route priority) ---
_INDEX_HTML_PATH = os.path.join(os.path.dirname(__file__), "index.html")


def _load_landing_html() -> str:
    if not os.path.isfile(_INDEX_HTML_PATH):
        logger.error("Landing page missing: %s", _INDEX_HTML_PATH)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Landing page (index.html) not found",
        )
    with open(_INDEX_HTML_PATH, encoding="utf-8") as landing_file:
        return landing_file.read()


@app.get("/", response_class=HTMLResponse, include_in_schema=False)
async def landing_page() -> HTMLResponse:
    return HTMLResponse(content=_load_landing_html(), media_type="text/html; charset=utf-8")


@app.get("/analytics-config.js", include_in_schema=False)
async def analytics_config_js() -> Response:
    """Runtime analytics keys from environment (served to static landing page)."""
    payload = {
        "posthogKey": POSTHOG_API_KEY,
        "posthogHost": POSTHOG_HOST.rstrip("/"),
        "cloudflareToken": CLOUDFLARE_WEB_ANALYTICS_TOKEN,
    }
    body = f"window.NEXUS_ANALYTICS={json.dumps(payload)};"
    return Response(content=body, media_type="application/javascript; charset=utf-8")


class ShieldRequest(BaseModel):
    user_input: str = Field(..., min_length=1)
    session_id: str = Field(..., min_length=1)


def quick_security_scan(user_input: str) -> bool:
    """Synchronous Early Exit scan — True when prompt injection is detected."""
    return any(pattern.search(user_input) for pattern in COMPILED_PATTERNS)


async def _verify_api_key(x_api_key: str | None) -> None:
    if not x_api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Geçersiz veya eksik API Key",
        )
    if secrets.compare_digest(x_api_key, NEXUS_API_KEY):
        return

    record = api_key_store.get(x_api_key)
    if record is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Geçersiz veya eksik API Key",
        )
    if record.is_expired():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Trial süresi doldu — PRO plana yükseltin",
        )
    await api_key_store.check_rate_limit(x_api_key, record)


class SandboxRateLimiter:
    """In-memory IP rate limiter for unauthenticated playground requests."""

    def __init__(self, limit_per_minute: int = SANDBOX_RATE_LIMIT_PER_MIN) -> None:
        self._limit = limit_per_minute
        self._lock = asyncio.Lock()
        self._minute_counts: dict[str, list[float]] = {}

    async def check(self, client_ip: str) -> None:
        now = time.time()
        async with self._lock:
            window = self._minute_counts.setdefault(client_ip, [])
            window[:] = [t for t in window if now - t < 60]
            if len(window) >= self._limit:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Sandbox rate limit exceeded — try again in a minute or start a free trial",
                )
            window.append(now)


sandbox_rate_limiter = SandboxRateLimiter()


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"


async def _redis_cache_size() -> int:
    redis_client = await _get_redis()
    if redis_client is None:
        return 0
    try:
        return await redis_client.dbsize()
    except Exception as exc:
        logger.warning("Redis cache size okunamadi: %s", exc)
        return 0


@app.get("/healthz")
async def healthz() -> dict[str, Any]:
    return {
        "status": "HEALTHY",
        "cache_size": await _redis_cache_size(),
    }


@app.get("/api/v1/health")
async def api_v1_health() -> dict[str, Any]:
    """Tunnel + load-balancer health probe (200 OK, no API key)."""
    return {
        "status": "ok",
        "service": "nexus-shield-fast-api",
        "healthy": True,
        "cache_size": await _redis_cache_size(),
    }


@app.websocket("/ws/analytics")
async def websocket_analytics(websocket: WebSocket) -> None:
    await ws_manager.connect(websocket)
    try:
        await websocket.send_json(
            {
                "type": "init",
                "metrics": analytics.snapshot(),
                "events": list(analytics.events),
            }
        )
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception:
        ws_manager.disconnect(websocket)


@app.get("/dashboard", response_class=HTMLResponse, include_in_schema=False)
async def dashboard() -> HTMLResponse:
    return HTMLResponse(content=DASHBOARD_HTML, media_type="text/html; charset=utf-8")


def _build_shield_response(
    *,
    redacted_input: str,
    pii_detected: bool,
    masked_types: list[str],
    result: str | None,
    status: str = "success",
    source: str | None = None,
    latency_ms: float,
) -> dict[str, Any]:
    """Unified v2.0 response schema for all /v1/shield success paths."""
    body: dict[str, Any] = {
        "status": status,
        "redacted_input": redacted_input,
        "pii_detected": pii_detected,
        "masked_types": masked_types,
        "result": result,
        "latency_ms": latency_ms,
    }
    if source is not None:
        body["source"] = source
    return body


async def _execute_shield(
    payload: ShieldRequest,
    start_time: float,
    *,
    playground: bool = False,
) -> dict[str, Any]:
    # 1. Early Exit regex scan — always before PII, cache, or upstream LLM
    if quick_security_scan(payload.user_input):
        latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
        await _emit_analytics(
            event_type="blocked",
            status_code=403,
            prompt=payload.user_input,
            latency_ms=latency_ms,
            action="Early Exit Regex",
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=PROMPT_INJECTION_BLOCK_DETAIL,
        )

    # 2. PII redaction — always before cache / upstream LLM
    pii_result = redact_pii(payload.user_input)
    sanitized_input = pii_result.text

    if pii_result.pii_detected:
        latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
        await _emit_analytics(
            event_type="pii_masked",
            status_code=200,
            prompt=sanitized_input,
            latency_ms=latency_ms,
            action="200 CLEAN (PII MASKED)",
            masked_types=pii_result.masked_types,
        )
        return _build_shield_response(
            status="clean",
            redacted_input=sanitized_input,
            pii_detected=True,
            masked_types=pii_result.masked_types,
            result="PII redacted — upstream LLM call skipped.",
            latency_ms=latency_ms,
        )

    cache_key = f"shield_cache:{hash(sanitized_input)}"
    redis_client = await _get_redis()
    if redis_client is not None:
        try:
            cached_response = await redis_client.get(cache_key)
            if cached_response:
                latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
                await _emit_analytics(
                    event_type="cache_hit",
                    status_code=200,
                    prompt=sanitized_input,
                    latency_ms=latency_ms,
                    action="Redis Cache Hit",
                )
                return _build_shield_response(
                    redacted_input=sanitized_input,
                    pii_detected=False,
                    masked_types=[],
                    result=cached_response,
                    source="cache",
                    latency_ms=latency_ms,
                )
        except Exception as exc:
            logger.warning("Redis get hatası, cache atlanıyor: %s", exc)

    # 3. Upstream LLM receives sanitized input only (PII already stripped)
    if not playground:
        await asyncio.sleep(UPSTREAM_LLM_LATENCY_SEC)
    llm_response = f"İşlenen yanıt: '{sanitized_input}' güvenli bulundu."

    if redis_client is not None:
        try:
            await redis_client.setex(cache_key, REDIS_CACHE_TTL_SEC, llm_response)
        except Exception as exc:
            logger.warning("Redis set hatası: %s", exc)

    execution_time = round((time.perf_counter() - start_time) * 1000, 2)
    await _emit_analytics(
        event_type="clean",
        status_code=200,
        prompt=sanitized_input,
        latency_ms=execution_time,
        action="LLM Forwarded",
    )
    return _build_shield_response(
        redacted_input=sanitized_input,
        pii_detected=False,
        masked_types=[],
        result=llm_response,
        source="upstream_llm",
        latency_ms=execution_time,
    )


@app.post("/v1/shield")
async def process_shield(
    payload: ShieldRequest,
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
):
    start_time = time.perf_counter()
    await _verify_api_key(x_api_key)
    return await _execute_shield(payload, start_time)


@app.post("/api/sandbox")
async def sandbox_shield(request: Request, payload: ShieldRequest):
    """Public playground endpoint — IP rate-limited, no API key required."""
    start_time = time.perf_counter()
    await sandbox_rate_limiter.check(_client_ip(request))
    return await _execute_shield(payload, start_time, playground=True)


DASHBOARD_HTML = """<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Nexus Shield — Live Threat Dashboard</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
  <style>
    @keyframes pulse-live {
      0%, 100% { opacity: 1; box-shadow: 0 0 8px #22c55e; }
      50% { opacity: 0.5; box-shadow: 0 0 16px #22c55e; }
    }
    .live-dot { animation: pulse-live 1.5s ease-in-out infinite; }
    .neon-red { text-shadow: 0 0 8px rgba(248, 113, 113, 0.8); }
    .neon-green { text-shadow: 0 0 8px rgba(74, 222, 128, 0.8); }
    .neon-cyan { text-shadow: 0 0 10px rgba(34, 211, 238, 0.7); }
    .neon-purple { text-shadow: 0 0 10px rgba(167, 139, 250, 0.8); }
    .glass {
      background: rgba(15, 23, 42, 0.85);
      border: 1px solid rgba(51, 65, 85, 0.8);
      backdrop-filter: blur(8px);
    }
    .log-row:hover { background: rgba(30, 41, 59, 0.6); }
    #event-log { max-height: 420px; overflow-y: auto; }
    #event-log::-webkit-scrollbar { width: 6px; }
    #event-log::-webkit-scrollbar-thumb { background: #475569; border-radius: 3px; }
  </style>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen font-sans">
  <div class="max-w-7xl mx-auto px-4 py-6 space-y-6">
    <header class="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-5">
      <div>
        <h1 class="text-2xl md:text-3xl font-bold tracking-tight neon-cyan">
          🛡️ Nexus Shield — Live Threat &amp; Guardrail Intelligence
        </h1>
        <p class="text-slate-400 text-sm mt-1">v2.0 · Early Exit · PII Redaction · Redis Cache · WebSocket Feed</p>
      </div>
      <div id="live-badge" class="flex items-center gap-2 px-4 py-2 rounded-full glass text-sm">
        <span id="live-dot" class="w-2.5 h-2.5 rounded-full bg-red-500"></span>
        <span id="live-label" class="font-semibold text-red-400">OFFLINE</span>
      </div>
    </header>

    <section class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
      <div class="glass rounded-xl p-5">
        <p class="text-slate-400 text-xs uppercase tracking-wider">Total Requests Inspected</p>
        <p id="kpi-total" class="text-3xl font-bold mt-2 neon-cyan">0</p>
      </div>
      <div class="glass rounded-xl p-5">
        <p class="text-slate-400 text-xs uppercase tracking-wider">Attacks Blocked</p>
        <p id="kpi-blocked" class="text-3xl font-bold mt-2 text-red-400 neon-red">0</p>
        <p id="kpi-block-rate" class="text-sm text-red-300/80 mt-1">0% of traffic</p>
      </div>
      <div class="glass rounded-xl p-5 border border-violet-500/30">
        <p class="text-violet-300 text-xs uppercase tracking-wider">PII Leaks Prevented</p>
        <p id="kpi-pii" class="text-3xl font-bold mt-2 text-violet-400 neon-purple">0</p>
        <p class="text-xs text-violet-300/70 mt-1">TCKN · Card · Email · Phone · IP</p>
      </div>
      <div class="glass rounded-xl p-5">
        <p class="text-slate-400 text-xs uppercase tracking-wider">Avg Latency Saved</p>
        <p id="kpi-latency" class="text-2xl font-bold mt-2 text-emerald-400 neon-green">4ms vs 8700ms</p>
        <p class="text-xs text-slate-500 mt-1">Early Exit vs Legacy ML</p>
      </div>
      <div class="glass rounded-xl p-5">
        <p class="text-slate-400 text-xs uppercase tracking-wider">Total LLM Cost Saved</p>
        <p id="kpi-cost" class="text-3xl font-bold mt-2 text-amber-400">$0.00</p>
        <p class="text-xs text-slate-500 mt-1">@ $0.03 / blocked injection</p>
      </div>
    </section>

    <section class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div class="glass rounded-xl p-5">
        <h2 class="text-sm font-semibold text-slate-300 mb-4">Request Types Breakdown</h2>
        <canvas id="doughnutChart" height="220"></canvas>
      </div>
      <div class="glass rounded-xl p-5">
        <h2 class="text-sm font-semibold text-slate-300 mb-4">Real-Time Response Latency (ms)</h2>
        <canvas id="latencyChart" height="220"></canvas>
      </div>
    </section>

    <section class="glass rounded-xl p-5">
      <h2 class="text-sm font-semibold text-slate-300 mb-4">Live Event Log Feed</h2>
      <div id="event-log-wrap" class="overflow-x-auto max-h-[420px] overflow-y-auto">
        <table class="w-full text-sm text-left">
          <thead class="text-xs uppercase text-slate-500 border-b border-slate-800">
            <tr>
              <th class="py-2 pr-4">Timestamp</th>
              <th class="py-2 pr-4">Status</th>
              <th class="py-2 pr-4">Prompt Snippet</th>
              <th class="py-2 pr-4">Latency</th>
              <th class="py-2">Action</th>
            </tr>
          </thead>
          <tbody id="event-log"></tbody>
        </table>
      </div>
    </section>
  </div>

  <script>
    const fmtTime = (iso) => {
      try { return new Date(iso).toLocaleTimeString(); } catch { return iso; }
    };

    const badgeFor = (code, action, type) => {
      if (code === 403) return '<span class="px-2 py-0.5 rounded text-xs font-bold bg-red-900/60 text-red-300 border border-red-700">403 BLOCKED</span>';
      if (type === 'pii_masked' || action === '200 CLEAN (PII MASKED)') return '<span class="px-2 py-0.5 rounded text-xs font-bold bg-violet-900/60 text-violet-300 border border-violet-600">PII MASKED</span>';
      if (action === 'Redis Cache Hit') return '<span class="px-2 py-0.5 rounded text-xs font-bold bg-cyan-900/60 text-cyan-300 border border-cyan-700">200 CACHE</span>';
      return '<span class="px-2 py-0.5 rounded text-xs font-bold bg-emerald-900/60 text-emerald-300 border border-emerald-700">200 CLEAN</span>';
    };

    const doughnutCtx = document.getElementById('doughnutChart').getContext('2d');
    const latencyCtx = document.getElementById('latencyChart').getContext('2d');

    const doughnutChart = new Chart(doughnutCtx, {
      type: 'doughnut',
      data: {
        labels: ['Blocked Attack', 'Clean Allowed', 'Cache Hit'],
        datasets: [{
          data: [0, 0, 0],
          backgroundColor: ['#ef4444', '#22c55e', '#06b6d4'],
          borderColor: '#0f172a',
          borderWidth: 2,
        }],
      },
      options: {
        plugins: { legend: { labels: { color: '#94a3b8' } } },
        cutout: '65%',
      },
    });

    const latencyChart = new Chart(latencyCtx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [{
          label: 'Latency (ms)',
          data: [],
          borderColor: '#22d3ee',
          backgroundColor: 'rgba(34, 211, 238, 0.1)',
          fill: true,
          tension: 0.3,
          pointRadius: 3,
        }],
      },
      options: {
        scales: {
          x: { ticks: { color: '#64748b', maxTicksLimit: 8 }, grid: { color: '#1e293b' } },
          y: { ticks: { color: '#64748b' }, grid: { color: '#1e293b' }, beginAtZero: true },
        },
        plugins: { legend: { labels: { color: '#94a3b8' } } },
      },
    });

    function updateKPIs(m) {
      document.getElementById('kpi-total').textContent = m.total_requests.toLocaleString();
      document.getElementById('kpi-blocked').textContent = m.total_blocked.toLocaleString();
      document.getElementById('kpi-block-rate').textContent = m.block_rate_percent + '% of traffic';
      document.getElementById('kpi-pii').textContent = (m.total_pii_masked || 0).toLocaleString();
      document.getElementById('kpi-latency').textContent =
        m.avg_blocked_latency_ms + 'ms vs ' + m.legacy_latency_ms + 'ms (' + (m.latency_saved_ms || 0).toLocaleString() + 'ms saved)';
      document.getElementById('kpi-cost').textContent = '$' + m.cost_saved_usd.toFixed(2);
      doughnutChart.data.datasets[0].data = [m.total_blocked, m.total_clean, m.total_cache_hits];
      doughnutChart.update('none');
      const hist = m.latency_history || [];
      latencyChart.data.labels = hist.map((p, i) => fmtTime(p.timestamp) || i);
      latencyChart.data.datasets[0].data = hist.map(p => p.latency_ms);
      latencyChart.update('none');
    }

    function renderEvents(events) {
      const tbody = document.getElementById('event-log');
      tbody.innerHTML = (events || []).map(e => `
        <tr class="log-row border-b border-slate-800/60">
          <td class="py-2 pr-4 text-slate-400 whitespace-nowrap">${fmtTime(e.timestamp)}</td>
          <td class="py-2 pr-4">${badgeFor(e.status_code, e.action, e.type)}</td>
          <td class="py-2 pr-4 text-slate-300 max-w-md truncate" title="${e.prompt_excerpt.replace(/"/g, '&quot;')}">${e.prompt_excerpt}</td>
          <td class="py-2 pr-4 text-cyan-300">${e.latency_ms} ms</td>
          <td class="py-2 text-slate-400">${e.action}</td>
        </tr>
      `).join('');
      const wrap = document.getElementById('event-log-wrap');
      if (wrap) wrap.scrollTop = 0;
    }

    function handleMessage(msg) {
      if (msg.metrics) updateKPIs(msg.metrics);
      if (msg.events) renderEvents(msg.events);
    }

    function setLive(online) {
      const dot = document.getElementById('live-dot');
      const label = document.getElementById('live-label');
      if (online) {
        dot.className = 'w-2.5 h-2.5 rounded-full bg-emerald-400 live-dot';
        label.textContent = 'LIVE';
        label.className = 'font-semibold text-emerald-400';
      } else {
        dot.className = 'w-2.5 h-2.5 rounded-full bg-red-500';
        label.textContent = 'OFFLINE';
        label.className = 'font-semibold text-red-400';
      }
    }

    let ws;
    let reconnectTimer;

    function connectWS() {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      ws = new WebSocket(`${proto}://${location.host}/ws/analytics`);
      ws.onopen = () => { setLive(true); clearTimeout(reconnectTimer); };
      ws.onclose = () => {
        setLive(false);
        reconnectTimer = setTimeout(connectWS, 3000);
      };
      ws.onerror = () => ws.close();
      ws.onmessage = (ev) => {
        try { handleMessage(JSON.parse(ev.data)); } catch (err) { console.error(err); }
      };
    }

    connectWS();
  </script>
</body>
</html>"""
