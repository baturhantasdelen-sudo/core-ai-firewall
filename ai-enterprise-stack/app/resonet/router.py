"""ResoNet OpenAI-compatible chat completions proxy with green routing."""

from __future__ import annotations

import logging
import time
from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, ConfigDict, Field

from app.core.config import Settings, get_settings
from app.core.db import log_telemetry
from app.core.metrics import compute_sustainability_metrics
from app.core.tokens import estimate_messages_tokens
from app.resonet.compressor import compress_messages, flatten_message_text
from app.resonet.router_engine import RouteDecision, select_route

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/resonet/v1", tags=["ResoNet"])


class ChatMessage(BaseModel):
    model_config = ConfigDict(extra="allow")

    role: str
    content: str | list[Any] | None = None
    name: str | None = None


class ChatCompletionRequest(BaseModel):
    model_config = ConfigDict(extra="allow")

    model: str
    messages: list[ChatMessage]
    temperature: float | None = None
    max_tokens: int | None = None
    stream: bool = False
    top_p: float | None = None
    frequency_penalty: float | None = None
    presence_penalty: float | None = None
    stop: str | list[str] | None = None
    user: str | None = None


class ResonetCompletionMeta(BaseModel):
    saved_input_tokens: int
    water_saved_ml: float
    energy_saved_wh: float
    carbon_saved_g: float
    compression_ratio_pct: float
    compression_method: str
    route_used: str
    route_reason: str


def _build_forward_headers(
    route: RouteDecision,
    request: Request,
    metrics_headers: dict[str, str],
) -> dict[str, str]:
    headers = {"Content-Type": "application/json", **metrics_headers}
    accept = request.headers.get("accept")
    if accept:
        headers["Accept"] = accept
    if route.api_key:
        headers["Authorization"] = f"Bearer {route.api_key}"
    return headers


def _ensure_route_ready(route: RouteDecision) -> None:
    if route.target.value == "cloud" and not route.api_key:
        raise HTTPException(
            status_code=503,
            detail="ResoNet cloud route selected but API key is not configured",
        )


async def _record_resonet_telemetry(
    *,
    route: str,
    status_code: int,
    water_saved_ml: float,
    energy_saved_wh: float,
    prompt_tokens: int,
    carbon_saved_g: float,
    compression_ratio_pct: float,
) -> None:
    await log_telemetry(
        module="ResoNet",
        route=route,
        status_code=status_code,
        water_saved_ml=water_saved_ml,
        energy_saved_wh=energy_saved_wh,
        prompt_tokens=prompt_tokens,
        carbon_saved_g=carbon_saved_g,
        compression_ratio_pct=compression_ratio_pct,
    )


@router.post("/chat/completions")
async def chat_completions(
    body: ChatCompletionRequest,
    request: Request,
    settings: Settings = Depends(get_settings),
) -> Response:
    """
    OpenAI-compatible chat completions with compression, smart routing,
    and sustainability response headers.
    """
    started = time.perf_counter()
    raw_messages = [msg.model_dump(exclude_none=True) for msg in body.messages]
    original_text = flatten_message_text(raw_messages)

    compression = compress_messages(
        raw_messages,
        token_threshold=settings.resonet_compression_token_threshold,
        use_llmlingua=settings.resonet_use_llmlingua,
    )
    compressed_messages = compression.messages
    compressed_text = flatten_message_text(compressed_messages)

    metrics = compute_sustainability_metrics(
        original_text,
        compressed_text,
        settings,
        compression_ratio_pct=compression.compression_ratio_pct,
    )
    prompt_tokens = estimate_messages_tokens(compressed_messages)
    route = select_route(compressed_messages, body.model, settings)
    _ensure_route_ready(route)

    forward_payload = body.model_dump(exclude_none=True)
    forward_payload["messages"] = compressed_messages
    forward_payload["model"] = route.model

    metrics_headers = metrics.as_response_headers()
    metrics_headers["X-Resonet-Route-Used"] = route.route_label
    metrics_headers["X-Resonet-Compression-Method"] = compression.method

    headers = _build_forward_headers(route, request, metrics_headers)
    url = f"{route.base_url}/chat/completions"
    timeout = httpx.Timeout(settings.resonet_request_timeout_seconds)

    logger.info(
        "ResoNet routing request",
        extra={
            "route": route.route_label,
            "reason": route.reason,
            "saved_tokens": metrics.saved_input_tokens,
            "compression_pct": compression.compression_ratio_pct,
            "method": compression.method,
        },
    )

    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            upstream = await client.post(url, json=forward_payload, headers=headers)
        except httpx.RequestError as exc:
            logger.exception("ResoNet upstream request failed", extra={"route": route.route_label})
            await _record_resonet_telemetry(
                route=route.route_label,
                status_code=502,
                water_saved_ml=metrics.water_saved_ml,
                energy_saved_wh=metrics.energy_saved_wh,
                prompt_tokens=prompt_tokens,
                carbon_saved_g=metrics.carbon_saved_g,
                compression_ratio_pct=compression.compression_ratio_pct,
            )
            raise HTTPException(
                status_code=502,
                detail={
                    "error": "upstream_unreachable",
                    "route": route.route_label,
                    "message": str(exc),
                },
            ) from exc

    await _record_resonet_telemetry(
        route=route.route_label,
        status_code=upstream.status_code,
        water_saved_ml=metrics.water_saved_ml,
        energy_saved_wh=metrics.energy_saved_wh,
        prompt_tokens=prompt_tokens,
        carbon_saved_g=metrics.carbon_saved_g,
        compression_ratio_pct=compression.compression_ratio_pct,
    )
    logger.debug(
        "ResoNet request completed in %.2f ms",
        (time.perf_counter() - started) * 1000,
    )

    response_headers = {
        **metrics_headers,
        "X-Resonet-Route-Reason": route.reason,
    }

    if body.stream:
        return Response(
            content=upstream.content,
            status_code=upstream.status_code,
            media_type=upstream.headers.get("content-type", "text/event-stream"),
            headers=response_headers,
        )

    if upstream.status_code >= 400:
        return JSONResponse(
            status_code=upstream.status_code,
            content=upstream.json()
            if upstream.headers.get("content-type", "").startswith("application/json")
            else {"error": upstream.text},
            headers=response_headers,
        )

    data = upstream.json()
    if isinstance(data, dict):
        data["resonet"] = ResonetCompletionMeta(
            saved_input_tokens=metrics.saved_input_tokens,
            water_saved_ml=metrics.water_saved_ml,
            energy_saved_wh=metrics.energy_saved_wh,
            carbon_saved_g=metrics.carbon_saved_g,
            compression_ratio_pct=compression.compression_ratio_pct,
            compression_method=compression.method,
            route_used=route.route_label,
            route_reason=route.reason,
        ).model_dump()

    return JSONResponse(
        content=data,
        status_code=upstream.status_code,
        headers=response_headers,
    )
