"""NexusShield OpenAI-compatible chat completions proxy."""

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
from app.core.tokens import estimate_messages_tokens
from app.nexusshield.guard import scan_and_sanitize_messages
from app.nexusshield.output_guard import scan_and_sanitize_completion

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/nexus/v1", tags=["NexusShield"])


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


class ChatCompletionResponse(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: str
    object: str = "chat.completion"
    created: int
    model: str
    choices: list[dict[str, Any]]
    usage: dict[str, int] | None = None
    nexusshield_redactions: int = Field(
        default=0,
        description="Number of PII fields redacted before upstream forwarding",
    )


def _resolve_upstream(settings: Settings) -> tuple[str, str]:
    base = str(settings.nexus_upstream_url or settings.openai_base_url).rstrip("/")
    api_key = settings.nexus_upstream_api_key or settings.openai_api_key
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="NexusShield upstream API key is not configured",
        )
    return base, api_key


async def _record_nexus_telemetry(
    *,
    route: str,
    status_code: int,
    redactions_count: int,
    threat_detected: str | None,
    prompt_tokens: int,
    output_redactions_count: int = 0,
    output_violation: str | None = None,
) -> None:
    await log_telemetry(
        module="NexusShield",
        route=route,
        status_code=status_code,
        redactions_count=redactions_count,
        threat_detected=threat_detected,
        prompt_tokens=prompt_tokens,
        output_redactions_count=output_redactions_count,
        output_violation=output_violation,
    )


@router.post("/chat/completions")
async def chat_completions(
    body: ChatCompletionRequest,
    request: Request,
    settings: Settings = Depends(get_settings),
) -> Response:
    """
    OpenAI-compatible chat completions with PII masking and injection blocking.

    Sanitizes all message content, rejects known injection patterns, then
    forwards the cleaned payload to the configured upstream LLM.
    """
    started = time.perf_counter()
    raw_messages = [msg.model_dump(exclude_none=True) for msg in body.messages]
    prompt_tokens = estimate_messages_tokens(raw_messages)
    guard_result = scan_and_sanitize_messages(raw_messages)

    if settings.nexus_injection_block and guard_result.injection_detected:
        logger.warning(
            "Prompt injection blocked",
            extra={"matches": guard_result.injection_matches},
        )
        await _record_nexus_telemetry(
            route="blocked",
            status_code=400,
            redactions_count=guard_result.redaction_count,
            threat_detected=", ".join(guard_result.injection_matches),
            prompt_tokens=prompt_tokens,
        )
        raise HTTPException(
            status_code=400,
            detail={
                "error": "prompt_injection_detected",
                "message": "Request rejected: potential prompt injection detected",
                "matches": list(guard_result.injection_matches),
            },
        )

    upstream_base, api_key = _resolve_upstream(settings)
    forward_payload = body.model_dump(exclude_none=True)
    forward_payload["messages"] = guard_result.messages

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    accept = request.headers.get("accept")
    if accept:
        headers["Accept"] = accept

    url = f"{upstream_base}/chat/completions"
    timeout = httpx.Timeout(settings.resonet_request_timeout_seconds)

    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            upstream = await client.post(url, json=forward_payload, headers=headers)
        except httpx.RequestError as exc:
            logger.exception("NexusShield upstream request failed")
            await _record_nexus_telemetry(
                route="cloud-provider",
                status_code=502,
                redactions_count=guard_result.redaction_count,
                threat_detected=None,
                prompt_tokens=prompt_tokens,
            )
            raise HTTPException(
                status_code=502,
                detail=f"Upstream LLM unreachable: {exc}",
            ) from exc

    output_redactions = 0
    output_violation: str | None = None
    response_headers = {
        "X-NexusShield-Redactions": str(guard_result.redaction_count),
    }

    if body.stream:
        await _record_nexus_telemetry(
            route="cloud-provider",
            status_code=upstream.status_code,
            redactions_count=guard_result.redaction_count,
            threat_detected=None,
            prompt_tokens=prompt_tokens,
        )
        return Response(
            content=upstream.content,
            status_code=upstream.status_code,
            media_type=upstream.headers.get("content-type", "text/event-stream"),
            headers=response_headers,
        )

    if upstream.status_code >= 400:
        await _record_nexus_telemetry(
            route="cloud-provider",
            status_code=upstream.status_code,
            redactions_count=guard_result.redaction_count,
            threat_detected=None,
            prompt_tokens=prompt_tokens,
        )
        return JSONResponse(
            status_code=upstream.status_code,
            content=upstream.json()
            if upstream.headers.get("content-type", "").startswith("application/json")
            else {"error": upstream.text},
            headers=response_headers,
        )

    data = upstream.json()
    if isinstance(data, dict) and settings.nexus_output_guard_enabled:
        output_result = scan_and_sanitize_completion(data)
        data = output_result.payload
        output_redactions = output_result.redaction_count
        if output_result.violations:
            output_violation = ", ".join(output_result.violations)
            logger.warning(
                "NexusShield output violations redacted",
                extra={"violations": output_result.violations},
            )
        data["nexusshield_output_redactions"] = output_redactions

    if isinstance(data, dict):
        data["nexusshield_redactions"] = guard_result.redaction_count

    await _record_nexus_telemetry(
        route="cloud-provider",
        status_code=upstream.status_code,
        redactions_count=guard_result.redaction_count,
        threat_detected=None,
        prompt_tokens=prompt_tokens,
        output_redactions_count=output_redactions,
        output_violation=output_violation,
    )
    logger.debug(
        "NexusShield request completed in %.2f ms",
        (time.perf_counter() - started) * 1000,
    )

    response_headers["X-NexusShield-Output-Redactions"] = str(output_redactions)

    return JSONResponse(
        content=data,
        status_code=upstream.status_code,
        headers=response_headers,
    )
