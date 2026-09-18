"""Complexity-based routing between local Ollama and cloud LLM providers."""

from __future__ import annotations

import re
from dataclasses import dataclass
from enum import Enum
from typing import Any

from app.core.config import Settings, get_settings

COMPLEX_KEYWORDS = re.compile(
    r"\b("
    r"analyze|architecture|refactor|implement|debug|optimize|"
    r"multi-?step|chain of thought|reasoning|proof|"
    r"compare and contrast|design pattern|distributed|"
    r"microservice|kubernetes|terraform|compliance|"
    r"security audit|threat model"
    r")\b",
    re.IGNORECASE,
)

SIMPLE_KEYWORDS = re.compile(
    r"^(?:what is|who is|when is|where is|define|translate|summarize in one sentence)\b",
    re.IGNORECASE,
)


class RouteTarget(str, Enum):
    LOCAL = "local"
    CLOUD = "cloud"


@dataclass(frozen=True, slots=True)
class RouteDecision:
    """Selected upstream route and model for a ResoNet request."""

    target: RouteTarget
    base_url: str
    api_key: str | None
    model: str
    reason: str
    route_label: str

    @property
    def is_local(self) -> bool:
        return self.target == RouteTarget.LOCAL


def _message_char_count(messages: list[dict[str, Any]]) -> int:
    total = 0
    for message in messages:
        content = message.get("content")
        if isinstance(content, str):
            total += len(content)
        elif isinstance(content, list):
            for part in content:
                if isinstance(part, dict) and part.get("type") == "text":
                    total += len(str(part.get("text", "")))
    return total


def resolve_model_name(requested_model: str, default: str) -> str:
    """Treat ``auto`` as a routing hint, not an upstream model identifier."""
    if not requested_model or requested_model.strip().lower() == "auto":
        return default
    return requested_model


def _combined_text(messages: list[dict[str, Any]]) -> str:
    chunks: list[str] = []
    for message in messages:
        content = message.get("content")
        if isinstance(content, str):
            chunks.append(content)
        elif isinstance(content, list):
            for part in content:
                if isinstance(part, dict) and part.get("type") == "text":
                    chunks.append(str(part.get("text", "")))
    return " ".join(chunks)


def select_route(
    messages: list[dict[str, Any]],
    requested_model: str,
    settings: Settings | None = None,
) -> RouteDecision:
    """
    Choose local Ollama vs cloud provider based on prompt complexity.

    Simple tasks (short prompts or basic Q&A patterns) route to Ollama.
    Complex tasks route to the configured cloud OpenAI-compatible API.
    """
    cfg = settings or get_settings()
    text = _combined_text(messages)
    char_count = _message_char_count(messages)
    has_complex_keyword = bool(COMPLEX_KEYWORDS.search(text))
    looks_simple_qa = bool(SIMPLE_KEYWORDS.search(text.strip()))

    use_local = (
        char_count < cfg.resonet_simple_char_threshold or looks_simple_qa
    ) and not has_complex_keyword

    if use_local:
        return RouteDecision(
            target=RouteTarget.LOCAL,
            base_url=str(cfg.ollama_base_url).rstrip("/"),
            api_key=None,
            model=resolve_model_name(requested_model, cfg.ollama_model),
            reason=(
                f"simple task detected (chars={char_count}, "
                f"simple_qa={looks_simple_qa})"
            ),
            route_label="ollama-local",
        )

    cloud_base = str(cfg.resonet_cloud_base_url or cfg.openai_base_url).rstrip("/")
    cloud_key = cfg.resonet_cloud_api_key or cfg.openai_api_key or None
    return RouteDecision(
        target=RouteTarget.CLOUD,
        base_url=cloud_base,
        api_key=cloud_key,
        model=resolve_model_name(requested_model, cfg.default_model),
        reason=(
            f"complex task detected (chars={char_count}, "
            f"complex_keyword={has_complex_keyword})"
        ),
        route_label="cloud-provider",
    )
