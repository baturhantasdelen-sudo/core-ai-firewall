"""Shared SentenceTransformer handle for semantic governance modules."""

from __future__ import annotations

from typing import Any

_model: Any | None = None
_intent_engine: Any | None = None


def set_model(model: Any | None) -> None:
    """Register the host application's embedding model."""
    global _model, _intent_engine
    _model = model
    _intent_engine = None


def get_model() -> Any | None:
    return _model


def get_intent_engine() -> Any:
    global _intent_engine
    if _intent_engine is None:
        from nexus_governance.nexus_intent_engine import IntentEngine

        _intent_engine = IntentEngine(model=_model)
    return _intent_engine
