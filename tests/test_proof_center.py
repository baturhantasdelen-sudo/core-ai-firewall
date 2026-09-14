"""Tests for Proof Center metrics loader."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from nexus_governance.proof_center import (
    DEFAULT_PROOF_CENTER_METRICS,
    load_proof_center_metrics,
    normalize_proof_center_metrics,
)
from nexus_shield_fast_api import app


def test_normalize_proof_center_metrics_from_benchmark_json() -> None:
    raw = {
        "latency_ms": {"avg": 7.28, "p95": 6.5},
        "attack_benchmark": {
            "blocked": 50,
            "samples": 50,
            "allowed": 0,
            "intent_divergence_accuracy_pct": 100.0,
        },
    }
    metrics = normalize_proof_center_metrics(raw)
    assert metrics["latency"]["avg_ms"] == 7.28
    assert metrics["latency"]["p95_ms"] == 6.5
    assert metrics["latency"]["certified_sub_10ms"] is True
    assert metrics["attack_benchmark"]["blocked"] == 50
    assert metrics["attack_benchmark"]["total"] == 50
    assert metrics["intent_divergence"]["accuracy_pct"] == 100.0


def test_load_proof_center_metrics_fallback() -> None:
    metrics = load_proof_center_metrics("/tmp/does-not-exist-proof-center.json")
    assert metrics["source"] == "default"
    assert metrics["latency"]["avg_ms"] == DEFAULT_PROOF_CENTER_METRICS["latency"]["avg_ms"]


def test_load_proof_center_metrics_from_file(tmp_path: Path) -> None:
    json_path = tmp_path / "proof_center_benchmark.json"
    json_path.write_text(
        json.dumps(
            {
                "latency_ms": {"avg": 8.1, "p95": 9.2},
                "attack_benchmark": {
                    "blocked": 48,
                    "samples": 50,
                    "intent_divergence_accuracy_pct": 96.0,
                },
            }
        ),
        encoding="utf-8",
    )
    metrics = load_proof_center_metrics(str(json_path))
    assert metrics["source"] == "live"
    assert metrics["attack_benchmark"]["blocked"] == 48
    assert metrics["attack_benchmark"]["total"] == 50


def test_proof_center_api_route() -> None:
    client = TestClient(app)
    response = client.get("/api/proof-center")
    assert response.status_code == 200
    body = response.json()
    assert "latency" in body
    assert "attack_benchmark" in body
    assert body["latency"]["avg_ms"] > 0
