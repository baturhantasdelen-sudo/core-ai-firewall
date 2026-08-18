"""Observability module and structured logging tests."""

from __future__ import annotations

import json

import pytest
from fastapi.testclient import TestClient

from nexus_observability import RequestMetrics, health_payload, log_violation


def test_health_payload_shape() -> None:
    body = health_payload(cache_size=3, service="test-service")
    assert body["status"] == "HEALTHY"
    assert body["cache_size"] == 3
    assert "timestamp" in body
    assert body["service"] == "test-service"


def test_request_metrics_summary() -> None:
    metrics = RequestMetrics(max_history=10)
    metrics.record(
        method="GET",
        path="/api/health",
        status_code=200,
        latency_ms=12.5,
        client_ip="127.0.0.1",
        decision="ALLOW",
    )
    metrics.record(
        method="POST",
        path="/v1/agent/action",
        status_code=403,
        latency_ms=20.0,
        client_ip="127.0.0.1",
        decision="BLOCK",
    )
    summary = metrics.summary()
    assert summary["total_requests"] == 2
    assert summary["blocked_403"] == 1
    assert summary["status_2xx"] == 1


def test_structured_logger_emits_json(caplog) -> None:
    import logging

    caplog.set_level(logging.WARNING, logger="nexus_shield.audit")
    log_violation(
        service="test",
        violation_type="DLP_VIOLATION",
        matched_rule="export_customer_pii",
        evidence_snippet='{"user_id":"1"}',
        method="POST",
        path="/v1/agent/action",
        client_ip="127.0.0.1",
    )
    assert any("policy_violation" in rec.message for rec in caplog.records)


def test_fast_api_health_endpoint() -> None:
    from nexus_shield_fast_api import app

    client = TestClient(app)
    response = client.get("/healthz")
    assert response.status_code == 200
    assert response.json()["status"] == "HEALTHY"
    assert "timestamp" in response.json()
