# -*- coding: utf-8 -*-
"""
Nexus Quantum Guard — Enterprise AI Firewall Microservice
=========================================================
Kurumsal FastAPI mikroservisi: async I/O + thread-safe ML tarama + Prometheus.

Çalıştırma:
    uvicorn nexus_shield_api:app --host 0.0.0.0 --port 8080

Uç noktalar:
    POST /v1/shield   — Prompt injection taraması (X-API-Key gerekli)
    GET  /healthz     — Production sağlık kontrolü (K8s probe, public)
    GET  /health      — Detaylı sağlık + önbellek istatistikleri
    GET  /metrics           — Prometheus metrikleri (scrape)
    GET  /metrics/summary   — JSON özet metrikleri (in-memory)

Güvenlik:
    X-API-Key header — NEXUS_API_KEY env (varsayılan: nexus_secret_key_123)
    Rate limit       — RATE_LIMIT_REQUESTS / RATE_LIMIT_WINDOW_SECONDS (in-memory)
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import secrets
import threading
import time
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from typing import Annotated, Any, Final

from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.responses import JSONResponse
from fastapi.security import APIKeyHeader
from pydantic import BaseModel, Field

from nexus_quantum_guard import (
    NEXUS_LATENCY,
    NEXUS_REQUESTS,
    ShieldApiResult,
    ThreadSafeGuardService,
    load_model_and_reference_matrix,
    record_nexus_inspection_metrics,
)

logger = logging.getLogger("NexusShieldAPI")

API_VERSION: Final[str] = "1.0.0"
SERVICE_NAME: Final[str] = "nexus-quantum-shield"
WARMUP_TEXT: Final[str] = "Nexus Quantum Guard warm-up probe sentence."
WARMUP_SESSION_ID: Final[str] = "startup-warmup"
API_KEY_HEADER: Final[str] = "X-API-Key"
DEFAULT_NEXUS_API_KEY: Final[str] = "nexus_secret_key_123"
NEXUS_API_KEY: Final[str] = os.getenv("NEXUS_API_KEY", DEFAULT_NEXUS_API_KEY)
SKIP_STARTUP_WARMUP: Final[bool] = os.getenv("NEXUS_SKIP_STARTUP_WARMUP", "").lower() in {
    "1",
    "true",
    "yes",
}
RATE_LIMIT_REQUESTS: Final[int] = int(os.getenv("RATE_LIMIT_REQUESTS", "60"))
RATE_LIMIT_WINDOW_SECONDS: Final[int] = int(os.getenv("RATE_LIMIT_WINDOW_SECONDS", "60"))

_api_key_header = APIKeyHeader(name=API_KEY_HEADER, auto_error=False)

_service: ThreadSafeGuardService | None = None

_metrics_lock = threading.Lock()
metrics_data: dict[str, int | float] = {
    "total_requests": 0,
    "blocked_attacks": 0,
    "passed_requests": 0,
    "total_latency_ms": 0.0,
}


from nexus_observability import (
    client_ip as _obs_client_ip,
    health_payload,
    log_request,
    log_violation,
    ml_logger as structured_logger,
    ml_metrics,
)


class InMemoryRateLimiter:
    """Tek worker / tek process için sabit pencere istek sayacı."""

    def __init__(self, max_requests: int, window_seconds: int) -> None:
        self._max_requests = max_requests
        self._window_seconds = window_seconds
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def check(self, client_key: str) -> None:
        now = time.monotonic()
        cutoff = now - self._window_seconds
        with self._lock:
            bucket = self._hits[client_key]
            while bucket and bucket[0] <= cutoff:
                bucket.popleft()
            if len(bucket) >= self._max_requests:
                raise HTTPException(
                    status_code=429,
                    detail="Rate limit exceeded. Try again later.",
                )
            bucket.append(now)


_rate_limiter = InMemoryRateLimiter(RATE_LIMIT_REQUESTS, RATE_LIMIT_WINDOW_SECONDS)


async def get_api_key(
    api_key: Annotated[str | None, Depends(_api_key_header)] = None,
) -> str:
    """X-API-Key header doğrulaması — geçersiz/eksik ise 401."""
    if not api_key or not secrets.compare_digest(api_key, NEXUS_API_KEY):
        raise HTTPException(status_code=401, detail="Invalid or missing API key.")
    return api_key


async def require_shield_access(api_key: Annotated[str, Depends(get_api_key)]) -> str:
    """Korumalı /v1/shield uç noktaları için API Key + rate limit bağımlılığı."""
    _rate_limiter.check(api_key)
    return api_key


def get_model_prediction(text: str, session_id: str = WARMUP_SESSION_ID) -> ShieldApiResult:
    """Model vektör çıkarımını / tam inceleme pipeline'ını tetikler (warm-up + canlı istekler)."""
    if _service is None:
        raise RuntimeError("Nexus AI Shield henüz hazır değil.")
    return _service.inspect(text, session_id)


def predict_pipeline(text: str, session_id: str = WARMUP_SESSION_ID) -> ShieldApiResult:
    """POST /v1/shield inceleme pipeline warm-up."""
    return get_model_prediction(text, session_id)


def validate_chat_pipeline(
    messages: list[str],
    session_id: str = WARMUP_SESSION_ID,
) -> ShieldApiResult:
    """POST /v1/shield/validate-chat pipeline warm-up."""
    body: dict[str, Any] = {
        "messages": [{"role": "user", "content": msg} for msg in messages],
    }
    user_text = _extract_user_text_from_chat_body(body)
    return get_model_prediction(user_text, session_id)


def _verify_startup_ready() -> HealthzResponse:
    """Warm-up sonrası servisin istek kabul edebileceğini doğrular."""
    health = _check_healthz()
    if health.status != "HEALTHY":
        raise RuntimeError(f"Startup readiness check failed: status={health.status}")
    return health


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Cold start önleme: model + referans matrisi yüklenir, her iki pipeline warm-up edilir."""
    global _service

    logger.info("Nexus Quantum Guard başlatılıyor...")

    try:
        service = await asyncio.to_thread(load_model_and_reference_matrix)
    except Exception as e:
        logger.error("Model yükleme başarısız: %s", e)
        app.state.guard_service = None
        _service = None
        yield
        return

    app.state.guard_service = service
    _service = service

    if SKIP_STARTUP_WARMUP:
        logger.info("Startup warm-up skipped (NEXUS_SKIP_STARTUP_WARMUP=1)")
    else:
        logger.info("Cold-Inference önleyici tam warm-up başlatılıyor...")
        try:
            await asyncio.to_thread(predict_pipeline, WARMUP_TEXT)
            await asyncio.to_thread(validate_chat_pipeline, [WARMUP_TEXT])
            logger.info("Warm-up başarıyla tamamlandı. Servis istek kabul etmeye hazır!")
        except Exception as e:
            logger.warning("Warm-up sırasında hata oluştu (kritik değil): %s", e)

    try:
        health = _verify_startup_ready()
        logger.info(
            "Uygulama istek kabul etmeye hazır | status=%s | cache_size=%d | version=%s",
            health.status,
            health.cache_size,
            API_VERSION,
        )
    except Exception as e:
        logger.error("Startup readiness check failed: %s", e)

    yield

    logger.info("Nexus Quantum Guard kapatılıyor...")
    app.state.guard_service = None
    _service = None


app = FastAPI(
    title="Nexus Quantum Guard - Enterprise AI Firewall",
    description="Defense-in-Depth prompt injection mikroservisi",
    version=API_VERSION,
    lifespan=lifespan,
    docs_url=None,
    redoc_url=None,
)


@app.middleware("http")
async def monitor_requests(request: Request, call_next):
    """Her HTTP isteği için latency ölçer, in-memory metrikleri ve JSON log yazar."""
    start_time = time.perf_counter()
    response = await call_next(request)
    process_time_ms = (time.perf_counter() - start_time) * 1000.0

    with _metrics_lock:
        metrics_data["total_requests"] = int(metrics_data["total_requests"]) + 1
        metrics_data["total_latency_ms"] = float(metrics_data["total_latency_ms"]) + process_time_ms
        if response.status_code == 403:
            metrics_data["blocked_attacks"] = int(metrics_data["blocked_attacks"]) + 1
        elif 200 <= response.status_code < 300:
            metrics_data["passed_requests"] = int(metrics_data["passed_requests"]) + 1

    log_request(structured_logger, ml_metrics, request, response, process_time_ms)
    return response


class GuardRequest(BaseModel):
    user_input: str = Field(..., min_length=1, description="Taranacak kullanıcı girdisi")
    session_id: str = Field(..., min_length=1, description="Oturum / izleme kimliği")


def _extract_user_text_from_chat_body(body: dict[str, Any]) -> str:
    """
    OpenAI /v1/chat/completions gövdesinden kullanıcı metnini çıkarır.

    Son kullanıcı mesajı + varsa system mesajları birleştirilir (jailbreak tespiti).
    """
    parts: list[str] = []
    messages = body.get("messages")
    if isinstance(messages, list):
        for msg in messages:
            if not isinstance(msg, dict):
                continue
            role = str(msg.get("role", "")).lower()
            content = msg.get("content", "")
            if isinstance(content, list):
                text_chunks = [
                    str(block.get("text", ""))
                    for block in content
                    if isinstance(block, dict) and block.get("type") == "text"
                ]
                content = " ".join(text_chunks)
            if role in ("user", "system") and content:
                parts.append(str(content).strip())
    if parts:
        return "\n".join(parts)
    prompt = body.get("prompt")
    if isinstance(prompt, str) and prompt.strip():
        return prompt.strip()
    input_text = body.get("input")
    if isinstance(input_text, str) and input_text.strip():
        return input_text.strip()
    single_message = body.get("message")
    if isinstance(single_message, str) and single_message.strip():
        return single_message.strip()
    raise HTTPException(status_code=400, detail="No user/system message found in chat body.")


class CleanShieldResponse(BaseModel):
    status: str
    session_id: str
    risk_score: float
    latency_ms: float
    latency_us: int
    detected_language: str | None = None


class HealthzResponse(BaseModel):
    status: str
    cache_size: int


def _process_memory_mb() -> float:
    """RSS bellek kullanımını MB cinsinden döndürür (health kontrolü)."""
    try:
        import psutil

        return round(psutil.Process(os.getpid()).memory_info().rss / (1024 * 1024), 2)
    except ImportError:
        return 0.0


def _check_healthz() -> HealthzResponse:
    """
    Servis hazırlığı, semantik önbellek erişimi ve bellek durumunu doğrular.

    Önbellek istatistikleri okunabiliyorsa semantic cache aktif kabul edilir.
    """
    if _service is None:
        raise HTTPException(
            status_code=503,
            detail={"status": "UNHEALTHY", "cache_size": 0},
        )
    _ = _process_memory_mb()
    cache_stats = _service.cache_stats()
    cache_size = int(cache_stats.get("size", 0))
    return HealthzResponse(status="HEALTHY", cache_size=cache_size)


def _get_service() -> ThreadSafeGuardService:
    if _service is None:
        raise HTTPException(status_code=503, detail="Nexus AI Shield henüz hazır değil.")
    return _service


async def _inspect_async(user_input: str, session_id: str) -> ShieldApiResult:
    """CPU-bound inspect işlemini thread pool'da çalıştırır (async uyumlu)."""
    service = _get_service()
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, service.inspect, user_input, session_id)


@app.get("/healthz", response_model=HealthzResponse)
async def healthz() -> HealthzResponse:
    """Production sağlık kontrolü — anında HEALTHY + önbellek boyutu."""
    return _check_healthz()


@app.get("/health")
async def health() -> dict[str, object]:
    cache_info = _service.cache_stats() if _service else {}
    cache_size = int(cache_info.get("size", 0))
    payload = health_payload(cache_size=cache_size, service=SERVICE_NAME)
    payload["version"] = API_VERSION
    payload["ready"] = str(_service is not None)
    return payload


@app.get("/api/health")
async def api_health() -> dict[str, object]:
    """Unified domain health probe — api.nexusshield.ai/api/health (nginx -> :8000)."""
    cache_info = _service.cache_stats() if _service else {}
    cache_size = int(cache_info.get("size", 0))
    return health_payload(cache_size=cache_size, service=SERVICE_NAME)


@app.get("/metrics/summary")
async def get_metrics_summary() -> dict[str, float | int]:
    """In-memory JSON metrik özeti — Prometheus /metrics ile birlikte kullanılır."""
    with _metrics_lock:
        total_requests = int(metrics_data["total_requests"])
        total_latency_ms = float(metrics_data["total_latency_ms"])
        avg_latency = total_latency_ms / total_requests if total_requests > 0 else 0.0
        summary = {
            "total_requests": total_requests,
            "blocked_attacks": int(metrics_data["blocked_attacks"]),
            "passed_requests": int(metrics_data["passed_requests"]),
            "avg_latency_ms": round(avg_latency, 2),
        }
    summary.update(ml_metrics.summary())
    return summary


@app.post(
    "/v1/shield",
    response_model=CleanShieldResponse,
    dependencies=[Depends(require_shield_access)],
    responses={
        403: {
            "description": "Prompt injection engellendi — tetiklenen katman detayları",
            "content": {
                "application/json": {
                    "example": {
                        "status": "BLOCKED",
                        "blocked_by": "Entropi İhlali",
                        "triggered_layer": {
                            "id": "entropy",
                            "name": "Entropi & Hile Filtresi",
                            "order": 0.0,
                        },
                        "latency_us": 8420,
                        "latency_ms": 8.42,
                    }
                }
            },
        }
    },
)
async def check_input(request: GuardRequest) -> CleanShieldResponse | JSONResponse:
    NEXUS_REQUESTS.inc()
    with NEXUS_LATENCY.time():
        result = await _inspect_async(request.user_input, request.session_id)
    record_nexus_inspection_metrics(result)

    if result.verdict.is_blocked:
        blocked_payload = result.to_blocked_payload()
        log_violation(
            service="nexus-api-prod",
            violation_type="PROMPT_INJECTION_BLOCKED",
            matched_rule=str(blocked_payload.get("blocked_by", "ml_pipeline")),
            evidence_snippet=request.user_input[:200],
            method="POST",
            path="/v1/shield",
            client_ip="internal",
            latency_ms=result.latency_us / 1000.0,
            extra={"session_id": request.session_id, "event_id": result.verdict.event_id},
        )
        return JSONResponse(status_code=403, content=blocked_payload)

    logger.info(
        "TEMIZ | session=%s | risk=%.4f | latency_us=%d",
        request.session_id,
        result.risk_score,
        result.latency_us,
    )
    clean = result.to_clean_payload()
    return CleanShieldResponse(**clean)


@app.post("/v1/shield/validate-chat", status_code=204, dependencies=[Depends(require_shield_access)])
async def validate_chat_completions(request: Request) -> Response:
    """
    Nginx gateway entegrasyonu — OpenAI chat/completions gövdesini doğrular.

    Temiz girdi: HTTP 204 (gövdesiz). Engellenen: HTTP 403 JSON.
    """
    raw = await request.body()
    if not raw:
        raise HTTPException(status_code=400, detail="Empty request body.")

    try:
        payload = json.loads(raw.decode("utf-8"))
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="Invalid JSON body.") from exc

    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="JSON body must be an object.")

    user_text = _extract_user_text_from_chat_body(payload)
    session_id = request.headers.get("X-Request-Id") or request.headers.get("X-Session-Id")
    if not session_id:
        session_id = f"nginx-{abs(hash(user_text)) % 10**12}"

    NEXUS_REQUESTS.inc()
    with NEXUS_LATENCY.time():
        result = await _inspect_async(user_text, session_id)
    record_nexus_inspection_metrics(result)

    if result.verdict.is_blocked:
        blocked_payload = result.to_blocked_payload()
        log_violation(
            service="nexus-api-prod",
            violation_type="PROMPT_INJECTION_BLOCKED",
            matched_rule=str(blocked_payload.get("blocked_by", "ml_pipeline")),
            evidence_snippet=user_text[:200],
            method="POST",
            path="/v1/shield/validate-chat",
            client_ip=_obs_client_ip(request),
            latency_ms=result.latency_us / 1000.0,
            extra={"session_id": session_id},
        )
        return JSONResponse(status_code=403, content=blocked_payload)

    return Response(status_code=204)
