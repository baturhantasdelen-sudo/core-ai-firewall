"""Prometheus metrik kayıt mantığı testleri."""

from __future__ import annotations

from nexus_quantum_guard import (
    BypassStrategy,
    GuardVerdict,
    NEXUS_BLOCKS,
    NEXUS_CACHE_HITS,
    ShieldApiResult,
    record_nexus_inspection_metrics,
)


def _blocked_result(strategy: BypassStrategy, *, cache_hit: bool = False) -> ShieldApiResult:
    verdict = GuardVerdict(
        prompt="test",
        is_blocked=True,
        bypass_strategy=strategy,
        similarity_score=0.9,
        matched_intent="test",
        entropy_report=None,
        event_id="evt-1",
        decision_label="BLOCK",
        latency_ms=1.0,
    )
    return ShieldApiResult(
        session_id="sess-1",
        verdict=verdict,
        latency_us=1000,
        cache_hit=cache_hit,
    )


def test_cache_hit_increments_counter() -> None:
    before = NEXUS_CACHE_HITS._value.get()  # noqa: SLF001 — test amaçlı
    record_nexus_inspection_metrics(
        _blocked_result(BypassStrategy.SEMANTIC_CACHE_HIT, cache_hit=True)
    )
    after = NEXUS_CACHE_HITS._value.get()  # noqa: SLF001
    assert after == before + 1


def test_block_increments_layer_counter() -> None:
    before = NEXUS_BLOCKS.labels(layer="Sanal Terminal")._value.get()  # noqa: SLF001
    record_nexus_inspection_metrics(_blocked_result(BypassStrategy.VIRTUAL_TERMINAL_PARADOX))
    after = NEXUS_BLOCKS.labels(layer="Sanal Terminal")._value.get()  # noqa: SLF001
    assert after == before + 1
