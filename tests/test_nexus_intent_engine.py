"""Unit tests for semantic IntentEngine (nexus_intent_engine)."""

from __future__ import annotations

from unittest.mock import MagicMock

import numpy as np

from nexus_governance.model_store import set_model
from nexus_governance.nexus_intent_engine import IntentEngine


def _build_mock_model(prompt_vec: list[float], tool_vec: list[float]) -> MagicMock:
    vectors = {
        0: np.asarray(prompt_vec, dtype=np.float32),
        1: np.asarray(tool_vec, dtype=np.float32),
    }

    def encode(texts, *args, **kwargs):
        batch = [texts] if isinstance(texts, str) else list(texts)
        return np.stack([vectors[index] for index in range(len(batch))])

    model = MagicMock()
    model.encode = MagicMock(side_effect=encode)
    return model


def test_semantic_intent_engine_flags_mismatch() -> None:
    model = _build_mock_model([1.0, 0.0, 0.0], [0.0, 1.0, 0.0])
    set_model(model)
    engine = IntentEngine(model=model, similarity_threshold=0.35)

    is_valid, score, details = engine.validate_intent(
        user_prompt="Bugün İstanbulda hava kaç derece?",
        tool_name="read_invoice",
        tool_purpose="Finansal fatura detaylarını veri tabanından sorgular.",
    )

    assert is_valid is False
    assert score == 0.0
    assert details["intent_matched"] is False
    assert details["flag"] == "INTENT_MISMATCH"


def test_semantic_intent_engine_passes_aligned_prompt() -> None:
    model = _build_mock_model([1.0, 0.2, 0.0], [1.0, 0.2, 0.0])
    set_model(model)
    engine = IntentEngine(model=model, similarity_threshold=0.35)

    is_valid, score, details = engine.validate_intent(
        user_prompt="Read invoice INV-99 for finance review",
        tool_name="read_invoice",
        tool_purpose="Fetch invoice details from database",
    )

    assert is_valid is True
    assert score == 1.0
    assert details["intent_matched"] is True
    assert details["flag"] is None


def test_semantic_intent_engine_skips_without_model() -> None:
    set_model(None)
    engine = IntentEngine(model=None)

    is_valid, score, details = engine.validate_intent(
        user_prompt="Any prompt",
        tool_name="read_invoice",
    )

    assert is_valid is True
    assert score == 1.0
    assert details["status"] == "SKIPPED"
