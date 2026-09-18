"""Managed Streamlit subprocess and reverse-proxy mount for FastAPI."""

from __future__ import annotations

import asyncio
import logging
import os
import subprocess
import sys
import time
from pathlib import Path
from typing import Any

import httpx
from fastapi import Request, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse, RedirectResponse, Response

from app.core.config import Settings

logger = logging.getLogger(__name__)

HOP_BY_HOP_HEADERS = {
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailers",
    "transfer-encoding",
    "upgrade",
    "host",
    "content-length",
}

_streamlit_process: subprocess.Popen[Any] | None = None
_proxy_client: httpx.AsyncClient | None = None
_streamlit_ready: bool = False


def normalize_base_path(base_path: str) -> str:
    """Streamlit expects baseUrlPath without leading or trailing slashes."""
    return base_path.strip().strip("/") or "dashboard"


def _dashboard_script() -> Path:
    return Path(__file__).resolve().parent.parent / "dashboard.py"


def _health_urls(settings: Settings) -> list[str]:
    """Candidate Streamlit readiness URLs (internal port)."""
    base_path = normalize_base_path(settings.streamlit_base_path)
    port = settings.streamlit_port
    return [
        f"http://127.0.0.1:{port}/{base_path}/_stcore/health",
        f"http://127.0.0.1:{port}/{base_path}/healthz",
        f"http://127.0.0.1:{port}/{base_path}/",
    ]


def is_streamlit_process_running() -> bool:
    """Return True when the managed Streamlit subprocess is alive."""
    return _streamlit_process is not None and _streamlit_process.poll() is None


async def _tcp_port_open(host: str, port: int, timeout: float = 1.0) -> bool:
    """Check whether a TCP port accepts connections."""
    try:
        _reader, writer = await asyncio.wait_for(
            asyncio.open_connection(host, port),
            timeout=timeout,
        )
        writer.close()
        await writer.wait_closed()
        return True
    except (OSError, asyncio.TimeoutError):
        return False


async def _probe_streamlit_health(
    settings: Settings,
    client: httpx.AsyncClient,
) -> bool:
    """Return True if any Streamlit health or root URL responds."""
    for url in _health_urls(settings):
        try:
            response = await client.get(url)
            if response.status_code < 500:
                return True
        except httpx.RequestError:
            continue
    return False


async def is_streamlit_ready(
    settings: Settings,
    *,
    wait_seconds: float = 0.0,
    poll_interval: float = 0.25,
) -> bool:
    """
    Check Streamlit readiness, optionally polling up to ``wait_seconds``.

    Uses TCP port check plus HTTP health probes.
    """
    global _streamlit_ready

    if not is_streamlit_process_running():
        _streamlit_ready = False
        return False

    if _streamlit_ready and wait_seconds <= 0:
        return True

    deadline = time.monotonic() + wait_seconds
    async with httpx.AsyncClient(timeout=2.0) as client:
        while True:
            if not is_streamlit_process_running():
                _streamlit_ready = False
                return False

            tcp_ok = await _tcp_port_open("127.0.0.1", settings.streamlit_port)
            if tcp_ok and await _probe_streamlit_health(settings, client):
                _streamlit_ready = True
                return True

            _streamlit_ready = False
            if time.monotonic() >= deadline:
                return False
            await asyncio.sleep(poll_interval)


def start_streamlit(settings: Settings) -> subprocess.Popen[Any]:
    """Launch Streamlit on an internal port with reverse-proxy-safe settings."""
    global _streamlit_process, _streamlit_ready
    _streamlit_ready = False

    if is_streamlit_process_running():
        return _streamlit_process  # type: ignore[return-value]

    base_path = normalize_base_path(settings.streamlit_base_path)
    cmd = [
        sys.executable,
        "-m",
        "streamlit",
        "run",
        str(_dashboard_script()),
        "--server.port",
        str(settings.streamlit_port),
        "--server.address",
        "127.0.0.1",
        "--server.headless",
        "true",
        "--server.baseUrlPath",
        base_path,
        "--server.enableCORS",
        "false",
        "--server.enableXsrfProtection",
        "false",
        "--server.enableWebsocketCompression",
        "false",
        "--browser.gatherUsageStats",
        "false",
    ]
    env = {
        **dict(os.environ),
        "TELEMETRY_DB_PATH": settings.telemetry_db_path,
    }
    _streamlit_process = subprocess.Popen(
        cmd,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        env=env,
    )
    logger.info(
        "Streamlit subprocess started (pid=%s) on 127.0.0.1:%s baseUrlPath=/%s",
        _streamlit_process.pid,
        settings.streamlit_port,
        base_path,
    )
    return _streamlit_process


def stop_streamlit() -> None:
    """Terminate the managed Streamlit subprocess."""
    global _streamlit_process, _streamlit_ready
    if is_streamlit_process_running():
        _streamlit_process.terminate()  # type: ignore[union-attr]
        try:
            _streamlit_process.wait(timeout=10)  # type: ignore[union-attr]
        except subprocess.TimeoutExpired:
            _streamlit_process.kill()  # type: ignore[union-attr]
        logger.info("Streamlit subprocess stopped")
    _streamlit_process = None
    _streamlit_ready = False


async def init_proxy_client(settings: Settings) -> httpx.AsyncClient:
    """Create a reusable HTTP client for proxying to Streamlit."""
    global _proxy_client
    if _proxy_client is None:
        _proxy_client = httpx.AsyncClient(
            base_url=f"http://127.0.0.1:{settings.streamlit_port}",
            timeout=httpx.Timeout(connect=5.0, read=120.0, write=30.0, pool=5.0),
            follow_redirects=True,
        )
    return _proxy_client


async def close_proxy_client() -> None:
    """Close the proxy HTTP client."""
    global _proxy_client
    if _proxy_client is not None:
        await _proxy_client.aclose()
        _proxy_client = None


async def wait_for_streamlit(
    settings: Settings,
    timeout_seconds: float = 5.0,
) -> None:
    """Block until Streamlit is ready or raise after ``timeout_seconds``."""
    if not is_streamlit_process_running():
        raise RuntimeError("Streamlit subprocess is not running")

    ready = await is_streamlit_ready(settings, wait_seconds=timeout_seconds)
    if not ready:
        raise RuntimeError(
            f"Streamlit not ready after {timeout_seconds}s "
            f"(checked TCP :{settings.streamlit_port} and health URLs)"
        )
    logger.info("Streamlit readiness confirmed")


def _service_unavailable(message: str) -> JSONResponse:
    return JSONResponse(
        status_code=503,
        content={"detail": message, "service": "streamlit-dashboard"},
    )


def _filtered_request_headers(request: Request) -> dict[str, str]:
    headers = {
        key: value
        for key, value in request.headers.items()
        if key.lower() not in HOP_BY_HOP_HEADERS
    }
    if request.client:
        headers["X-Forwarded-For"] = request.client.host
    headers["X-Forwarded-Proto"] = request.url.scheme
    headers["X-Forwarded-Host"] = request.headers.get("host", "localhost:8080")
    return headers


def _filtered_response_headers(headers: httpx.Headers) -> dict[str, str]:
    return {
        key: value
        for key, value in headers.items()
        if key.lower() not in HOP_BY_HOP_HEADERS
    }


async def proxy_streamlit_http(request: Request, path: str, settings: Settings) -> Response:
    """Reverse-proxy an HTTP request to the internal Streamlit server."""
    try:
        if not is_streamlit_process_running():
            logger.warning("Streamlit subprocess not running; restarting")
            start_streamlit(settings)

        if not await is_streamlit_ready(settings, wait_seconds=5.0):
            return _service_unavailable(
                "Dashboard is starting up. Retry in a few seconds."
            )

        client = await init_proxy_client(settings)
        base_path = normalize_base_path(settings.streamlit_base_path)
        upstream_path = f"/{base_path}/{path}".rstrip("/") if path else f"/{base_path}/"

        upstream_response = await client.request(
            request.method,
            upstream_path,
            params=request.query_params,
            content=await request.body(),
            headers=_filtered_request_headers(request),
        )

        return Response(
            content=upstream_response.content,
            status_code=upstream_response.status_code,
            headers=_filtered_response_headers(upstream_response.headers),
            media_type=upstream_response.headers.get("content-type"),
        )
    except httpx.RequestError as exc:
        logger.warning("Streamlit HTTP proxy connection failed: %s", exc)
        return _service_unavailable(f"Dashboard temporarily unavailable: {exc}")
    except Exception:
        logger.exception("Unhandled Streamlit HTTP proxy error")
        return _service_unavailable("Dashboard proxy encountered an internal error.")


async def _relay_websocket(
    client_ws: WebSocket,
    upstream_ws: Any,
) -> None:
    """Bidirectionally relay messages until one side disconnects."""

    async def client_to_upstream() -> None:
        while True:
            message = await client_ws.receive()
            if message["type"] == "websocket.disconnect":
                break
            if message.get("text") is not None:
                await upstream_ws.send(message["text"])
            elif message.get("bytes") is not None:
                await upstream_ws.send(message["bytes"])

    async def upstream_to_client() -> None:
        while True:
            payload = await upstream_ws.recv()
            if isinstance(payload, bytes):
                await client_ws.send_bytes(payload)
            else:
                await client_ws.send_text(payload)

    tasks = [
        asyncio.create_task(client_to_upstream()),
        asyncio.create_task(upstream_to_client()),
    ]
    done, pending = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
    for task in pending:
        task.cancel()
    for task in done:
        exc = task.exception()
        if exc and not isinstance(exc, WebSocketDisconnect):
            raise exc


async def proxy_streamlit_websocket(
    websocket: WebSocket,
    path: str,
    settings: Settings,
) -> None:
    """Reverse-proxy a WebSocket connection to Streamlit's internal endpoint."""
    import websockets

    if not is_streamlit_process_running():
        start_streamlit(settings)

    if not await is_streamlit_ready(settings, wait_seconds=5.0):
        await websocket.close(code=1013, reason="Dashboard is starting up")
        return

    base_path = normalize_base_path(settings.streamlit_base_path)
    query_string = websocket.scope.get("query_string", b"").decode()
    upstream_uri = (
        f"ws://127.0.0.1:{settings.streamlit_port}"
        f"/{base_path}/_stcore/{path}"
    )
    if query_string:
        upstream_uri = f"{upstream_uri}?{query_string}"

    subprotocols = list(websocket.scope.get("subprotocols") or [])
    await websocket.accept()

    try:
        async with websockets.connect(
            upstream_uri,
            subprotocols=subprotocols or None,
            open_timeout=5,
            ping_interval=None,
        ) as upstream:
            await _relay_websocket(websocket, upstream)
    except WebSocketDisconnect:
        logger.debug("Client WebSocket disconnected")
    except Exception:
        logger.exception("Streamlit WebSocket proxy failed for %s", upstream_uri)
        if websocket.client_state.name != "DISCONNECTED":
            await websocket.close(code=1011)


def dashboard_redirect(settings: Settings) -> RedirectResponse:
    """Redirect bare /dashboard requests to the trailing-slash Streamlit root."""
    base_path = normalize_base_path(settings.streamlit_base_path)
    return RedirectResponse(url=f"/{base_path}/", status_code=307)


async def dashboard_healthz(settings: Settings) -> Response:
    """Expose dashboard readiness for operators and load balancers."""
    ready = await is_streamlit_ready(settings, wait_seconds=5.0)
    payload = {
        "status": "ok" if ready else "starting",
        "streamlit_running": is_streamlit_process_running(),
        "ready": ready,
    }
    return JSONResponse(status_code=200 if ready else 503, content=payload)
