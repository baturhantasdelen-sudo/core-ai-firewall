from __future__ import annotations

import json
import logging
from typing import Any

import httpx
from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse, PlainTextResponse

from nexus_shield_cli.sanitize import MaskOptions, sanitize_chat_payload

logger = logging.getLogger("nexus_shield_cli.proxy")


def create_app(*, upstream_base: str, mask_options: MaskOptions) -> FastAPI:
    upstream_base = upstream_base.rstrip("/")
    app = FastAPI(title="Nexus Shield Local Proxy", version="0.1.0")

    @app.get("/healthz")
    async def healthz() -> PlainTextResponse:
        return PlainTextResponse("HEALTHY")

    @app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
    async def proxy(path: str, request: Request) -> Response:
        upstream_url = f"{upstream_base}/{path}"
        if request.url.query:
            upstream_url = f"{upstream_url}?{request.url.query}"

        headers = {
            key: value
            for key, value in request.headers.items()
            if key.lower() not in {"host", "content-length"}
        }

        body = await request.body()
        masked_types: list[str] = []

        if request.method in {"POST", "PUT", "PATCH"} and body:
            content_type = request.headers.get("content-type", "")
            if "application/json" in content_type:
                try:
                    payload = json.loads(body.decode("utf-8"))
                except json.JSONDecodeError:
                    payload = None
                if isinstance(payload, dict) and path.endswith(("chat/completions", "completions", "responses")):
                    payload, masked_types = sanitize_chat_payload(payload, mask_options)
                    body = json.dumps(payload).encode("utf-8")
                    if masked_types:
                        logger.info("PII masked before upstream forward: %s", ", ".join(masked_types))

        async with httpx.AsyncClient(timeout=httpx.Timeout(120.0)) as client:
            upstream_response = await client.request(
                request.method,
                upstream_url,
                headers=headers,
                content=body if body else None,
            )

        response_headers = {
            key: value
            for key, value in upstream_response.headers.items()
            if key.lower() not in {"content-encoding", "transfer-encoding", "content-length"}
        }

        if masked_types:
            response_headers["X-Nexus-Shield-Masked"] = ",".join(masked_types)

        return Response(
            content=upstream_response.content,
            status_code=upstream_response.status_code,
            headers=response_headers,
            media_type=upstream_response.headers.get("content-type"),
        )

    return app


def run_proxy(*, host: str, port: int, upstream_base: str, mask_options: MaskOptions) -> None:
    import uvicorn

    app = create_app(upstream_base=upstream_base, mask_options=mask_options)
    logger.info("Nexus Shield proxy listening on http://%s:%s/v1", host, port)
    logger.info("Forwarding sanitized requests to %s", upstream_base)
    uvicorn.run(app, host=host, port=port, log_level="info")
