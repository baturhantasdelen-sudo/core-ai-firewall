"""Structured JSON logging, in-memory request metrics, and audit trail helpers."""

from __future__ import annotations

import json
import logging
import threading
import time
from collections import deque
from datetime import datetime, timezone
from typing import Any

from starlette.requests import Request
from starlette.responses import Response


def iso_timestamp() -> str:
    return datetime.now(timezone.utc).isoformat()


class JSONFormatter(logging.Formatter):
    """Emit one JSON object per log line."""

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "timestamp": iso_timestamp(),
            "level": record.levelname,
            "message": record.getMessage(),
        }
        extra_data = getattr(record, "extra_data", None)
        if isinstance(extra_data, dict):
            payload.update(extra_data)
        return json.dumps(payload, ensure_ascii=False)


def configure_logger(name: str) -> logging.Logger:
    log = logging.getLogger(name)
    if not log.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(JSONFormatter())
        log.addHandler(handler)
        log.setLevel(logging.INFO)
        log.propagate = False
    return log


ml_logger = configure_logger("nexus_shield.ml")
fast_logger = configure_logger("nexus_shield.fast")
audit_logger = configure_logger("nexus_shield.audit")


class RequestMetrics:
    """Thread-safe rolling window of recent requests + aggregate counters."""

    def __init__(self, max_history: int = 100) -> None:
        self._lock = threading.Lock()
        self._history: deque[dict[str, Any]] = deque(maxlen=max_history)
        self.total_requests = 0
        self.status_2xx = 0
        self.status_4xx = 0
        self.status_5xx = 0
        self.blocked_403 = 0
        self.total_latency_ms = 0.0

    def record(
        self,
        *,
        method: str,
        path: str,
        status_code: int,
        latency_ms: float,
        client_ip: str,
        decision: str,
    ) -> None:
        entry = {
            "timestamp": iso_timestamp(),
            "method": method,
            "path": path,
            "status_code": status_code,
            "latency_ms": round(latency_ms, 2),
            "client_ip": client_ip,
            "decision": decision,
        }
        with self._lock:
            self._history.append(entry)
            self.total_requests += 1
            self.total_latency_ms += latency_ms
            if 200 <= status_code < 300:
                self.status_2xx += 1
            elif 400 <= status_code < 500:
                self.status_4xx += 1
            elif status_code >= 500:
                self.status_5xx += 1
            if status_code == 403:
                self.blocked_403 += 1

    def summary(self) -> dict[str, Any]:
        with self._lock:
            total = self.total_requests
            avg_latency = self.total_latency_ms / total if total else 0.0
            error_rate_5xx = (self.status_5xx / total * 100.0) if total else 0.0
            return {
                "total_requests": total,
                "status_2xx": self.status_2xx,
                "status_4xx": self.status_4xx,
                "status_5xx": self.status_5xx,
                "blocked_403": self.blocked_403,
                "avg_latency_ms": round(avg_latency, 2),
                "error_rate_5xx_pct": round(error_rate_5xx, 2),
                "recent_count": len(self._history),
            }

    def recent(self, limit: int = 100) -> list[dict[str, Any]]:
        with self._lock:
            return list(self._history)[-limit:]


ml_metrics = RequestMetrics()
fast_metrics = RequestMetrics()


def client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    cf_ip = request.headers.get("CF-Connecting-IP")
    if cf_ip:
        return cf_ip
    if request.client:
        return request.client.host
    return "unknown"


def decision_from_status(status_code: int) -> str:
    if status_code == 403:
        return "BLOCK"
    if 200 <= status_code < 300:
        return "ALLOW"
    if status_code >= 500:
        return "ERROR"
    return "ALLOW"


def log_request(
    logger: logging.Logger,
    metrics: RequestMetrics,
    request: Request,
    response: Response,
    latency_ms: float,
    *,
    decision: str | None = None,
) -> None:
    resolved_decision = decision or decision_from_status(response.status_code)
    ip = client_ip(request)
    metrics.record(
        method=request.method,
        path=request.url.path,
        status_code=response.status_code,
        latency_ms=latency_ms,
        client_ip=ip,
        decision=resolved_decision,
    )
    logger.info(
        "request_processed",
        extra={
            "extra_data": {
                "timestamp": iso_timestamp(),
                "level": "INFO",
                "method": request.method,
                "path": request.url.path,
                "status_code": response.status_code,
                "latency_ms": round(latency_ms, 2),
                "client_ip": ip,
                "decision": resolved_decision,
            }
        },
    )


def log_violation(
    *,
    service: str,
    violation_type: str,
    matched_rule: str,
    evidence_snippet: str,
    method: str,
    path: str,
    client_ip: str,
    status_code: int = 403,
    latency_ms: float | None = None,
    extra: dict[str, Any] | None = None,
) -> None:
    payload: dict[str, Any] = {
        "timestamp": iso_timestamp(),
        "level": "WARNING",
        "service": service,
        "method": method,
        "path": path,
        "status_code": status_code,
        "decision": "BLOCK",
        "violation_type": violation_type,
        "matched_rule": matched_rule,
        "evidence_snippet": evidence_snippet[:200],
        "client_ip": client_ip,
    }
    if latency_ms is not None:
        payload["latency_ms"] = round(latency_ms, 2)
    if extra:
        payload.update(extra)
    audit_logger.warning("policy_violation", extra={"extra_data": payload})


def health_payload(*, cache_size: int, service: str) -> dict[str, Any]:
    return {
        "status": "HEALTHY",
        "cache_size": cache_size,
        "timestamp": iso_timestamp(),
        "service": service,
    }
