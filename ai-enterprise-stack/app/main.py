"""Combined FastAPI entrypoint for NexusShield and ResoNet Gateway."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI, Request, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

from app import __version__
from app.core.config import get_settings
from app.core.db import init_db
from app.core.streamlit_mount import (
    close_proxy_client,
    dashboard_healthz,
    dashboard_redirect,
    init_proxy_client,
    normalize_base_path,
    proxy_streamlit_http,
    proxy_streamlit_websocket,
    start_streamlit,
    stop_streamlit,
    wait_for_streamlit,
)
from app.nexusshield.router import router as nexus_router
from app.resonet.router import router as resonet_router

settings = get_settings()

logging.basicConfig(
    level=getattr(logging, settings.log_level),
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    logger.info(
        "Starting %s v%s",
        settings.app_name,
        settings.app_version,
    )
    await init_db(settings)

    if settings.streamlit_enabled:
        start_streamlit(settings)
        try:
            await wait_for_streamlit(settings, timeout_seconds=5.0)
        except RuntimeError as exc:
            logger.warning(
                "%s — API will serve 503 on /dashboard until Streamlit is ready",
                exc,
            )
        await init_proxy_client(settings)

    yield

    if settings.streamlit_enabled:
        await close_proxy_client()
        stop_streamlit()

    logger.info("Shutting down %s", settings.app_name)


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version or __version__,
    description=(
        "Enterprise AI Proxy Gateway — NexusShield (security guardrails) "
        "and ResoNet Gateway (green AI routing & compression)."
    ),
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=[
        "X-NexusShield-Redactions",
        "X-NexusShield-Output-Redactions",
        "X-Resonet-Water-Saved-mL",
        "X-Resonet-Compression-Ratio-Pct",
        "X-Resonet-Compression-Method",
        "X-Resonet-Grid-Region",
        "X-Resonet-Energy-Saved-Wh",
        "X-Resonet-Route-Used",
        "X-Resonet-Tokens-Saved",
        "X-Resonet-Carbon-Saved-g",
        "X-Resonet-Route-Reason",
    ],
)

app.include_router(nexus_router)
app.include_router(resonet_router)


if settings.streamlit_enabled:
    base = normalize_base_path(settings.streamlit_base_path)

    @app.get(f"/{base}", tags=["Dashboard"], include_in_schema=False)
    async def dashboard_root_redirect() -> object:
        return dashboard_redirect(settings)

    @app.get(f"/{base}/healthz", tags=["Dashboard"], include_in_schema=False)
    async def dashboard_healthz_route() -> object:
        return await dashboard_healthz(settings)

    @app.api_route(
        f"/{base}/{{path:path}}",
        methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"],
        tags=["Dashboard"],
        include_in_schema=False,
    )
    async def dashboard_proxy(request: Request, path: str) -> object:
        return await proxy_streamlit_http(request, path, settings)

    @app.websocket(f"/{base}/_stcore/{{path:path}}")
    async def dashboard_websocket_proxy(websocket: WebSocket, path: str) -> None:
        await proxy_streamlit_websocket(websocket, path, settings)

    # Fallback when clients request Streamlit core paths without the base prefix
    @app.api_route(
        "/_stcore/{path:path}",
        methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"],
        include_in_schema=False,
    )
    async def streamlit_core_http_fallback(request: Request, path: str) -> object:
        return await proxy_streamlit_http(request, f"_stcore/{path}", settings)

    @app.websocket("/_stcore/{path:path}")
    async def streamlit_core_ws_fallback(websocket: WebSocket, path: str) -> None:
        await proxy_streamlit_websocket(websocket, path, settings)

else:
    _dashboard_url = f"http://localhost:{settings.streamlit_port}/"

    @app.get("/dashboard", tags=["Dashboard"], include_in_schema=False)
    @app.get("/dashboard/", tags=["Dashboard"], include_in_schema=False)
    async def dashboard_external_redirect() -> RedirectResponse:
        """Dual-port mode: Command Center runs on :8501, not behind this API."""
        return RedirectResponse(url=_dashboard_url, status_code=307)


@app.get("/healthz", tags=["Health"])
async def healthz() -> dict[str, str]:
    """Liveness probe."""
    return {"status": "ok", "service": settings.app_name, "version": settings.app_version}


@app.get("/", tags=["Health"])
async def root() -> dict[str, object]:
    """Service catalog."""
    catalog: dict[str, object] = {
        "service": settings.app_name,
        "version": settings.app_version,
        "modules": {
            "nexusshield": {
                "description": "Enterprise AI Security & Privacy Guardrail",
                "endpoint": "/nexus/v1/chat/completions",
            },
            "resonet": {
                "description": "Resource-Aware Green AI & Sustainability Engine",
                "endpoint": "/resonet/v1/chat/completions",
            },
        },
        "health": "/healthz",
    }
    if settings.streamlit_enabled:
        base = normalize_base_path(settings.streamlit_base_path)
        catalog["dashboard"] = f"/{base}/"
        catalog["dashboard_health"] = f"/{base}/healthz"
    else:
        catalog["dashboard"] = f"http://localhost:{settings.streamlit_port}/"
        catalog["dashboard_note"] = (
            "Run separately: streamlit run app/dashboard.py --server.port "
            f"{settings.streamlit_port}"
        )
    return catalog
