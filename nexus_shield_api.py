# -*- coding: utf-8 -*-
"""
Nexus Quantum Guard — Enterprise AI Firewall Microservice
=========================================================
Kurumsal FastAPI mikroservisi: async I/O + thread-safe ML tarama + Prometheus.

Çalıştırma:
    uvicorn nexus_shield_api:app --host 0.0.0.0 --port 8080

Uç noktalar:
    POST /v1/shield   — Prompt injection taraması
    GET  /healthz     — Production sağlık kontrolü (K8s probe)
    GET  /health      — Detaylı sağlık + önbellek istatistikleri
    GET  /metrics     — Prometheus metrikleri
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from contextlib import asynccontextmanager
from typing import Any, Final

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from nexus_quantum_guard import (
    NEXUS_LATENCY,
    NEXUS_REQUESTS,
    ShieldApiResult,
    ThreadSafeGuardService,
    record_nexus_inspection_metrics,
)

logger = logging.getLogger("NexusShieldAPI")

API_VERSION: Final[str] = "1.0.0"
SERVICE_NAME: Final[str] = "nexus-quantum-shield"

_service: ThreadSafeGuardService | None = None


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Cold start önleme: vektör modeli startup'ta bir kez yüklenir."""
    global _service
    logger.info("Nexus Quantum Guard mikroservisi başlatılıyor...")
    _service = ThreadSafeGuardService()
    logger.info("Nexus AI Shield hazır | version=%s", API_VERSION)
    yield
    _service = None
    logger.info("Nexus AI Shield kapatıldı.")


app = FastAPI(
    title="Nexus Quantum Guard - Enterprise AI Firewall",
    description="Defense-in-Depth prompt injection mikroservisi",
    version=API_VERSION,
    lifespan=lifespan,
    docs_url=None,
    redoc_url=None,
)


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
    return await asyncio.to_thread(service.inspect, user_input, session_id)


@app.get("/healthz", response_model=HealthzResponse)
async def healthz() -> HealthzResponse:
    """Production sağlık kontrolü — anında HEALTHY + önbellek boyutu."""
    return _check_healthz()


@app.get("/health")
async def health() -> dict[str, object]:
    cache_info = _service.cache_stats() if _service else {}
    return {
        "status": "ok",
        "service": SERVICE_NAME,
        "version": API_VERSION,
        "ready": str(_service is not None),
        "semantic_cache": cache_info,
    }


@app.post(
    "/v1/shield",
    response_model=CleanShieldResponse,
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
        logger.warning(
            "ENGEL | session=%s | katman=%s | cache=%s | latency_us=%d | event=%s",
            request.session_id,
            blocked_payload.get("blocked_by"),
            result.cache_match_mode or "pipeline",
            result.latency_us,
            result.verdict.event_id,
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


@app.post("/v1/shield/validate-chat", status_code=204)
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
        logger.warning(
            "NGINX GATEWAY ENGEL | session=%s | katman=%s",
            session_id,
            blocked_payload.get("blocked_by"),
        )
        return JSONResponse(status_code=403, content=blocked_payload)

    return Response(status_code=204)
