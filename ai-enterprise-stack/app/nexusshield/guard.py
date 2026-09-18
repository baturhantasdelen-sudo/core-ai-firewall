"""PII redaction and prompt-injection heuristics for NexusShield."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

EMAIL_PATTERN = re.compile(
    r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b",
    re.IGNORECASE,
)

PHONE_PATTERN = re.compile(
    r"""
    (?:
        \+?\d{1,3}[\s.-]?
    )?
    (?:
        \(?\d{2,4}\)?[\s.-]?
    )
    \d{3}[\s.-]?\d{2,4}[\s.-]?\d{2,4}
    """,
    re.VERBOSE,
)

CREDIT_CARD_PATTERN = re.compile(
    r"\b(?:\d[ -]*?){13,19}\b",
)

INJECTION_PATTERNS: tuple[re.Pattern[str], ...] = tuple(
    re.compile(p, re.IGNORECASE)
    for p in (
        r"ignore\s+(?:all\s+)?previous\s+instructions?",
        r"disregard\s+(?:all\s+)?(?:prior|previous)\s+(?:instructions?|prompts?)",
        r"forget\s+(?:everything|all)\s+(?:above|before)",
        r"override\s+(?:system|safety)\s+(?:prompt|instructions?)",
        r"you\s+are\s+now\s+(?:dan|jailbreak|unrestricted)",
        r"reveal\s+(?:the\s+)?(?:system|hidden)\s+prompt",
        r"do\s+not\s+follow\s+(?:your|the)\s+(?:rules|guidelines)",
    )
)

REDACTIONS: tuple[tuple[re.Pattern[str], str], ...] = (
    (EMAIL_PATTERN, "[REDACTED_EMAIL]"),
    (PHONE_PATTERN, "[REDACTED_PHONE]"),
    (CREDIT_CARD_PATTERN, "[REDACTED_CREDIT_CARD]"),
)


@dataclass(frozen=True, slots=True)
class GuardResult:
    """Outcome of a NexusShield guard pass."""

    messages: list[dict[str, Any]]
    redaction_count: int
    injection_detected: bool
    injection_matches: tuple[str, ...] = field(default_factory=tuple)


def _redact_text(text: str) -> tuple[str, int]:
    redactions = 0
    sanitized = text
    for pattern, replacement in REDACTIONS:
        sanitized, count = pattern.subn(replacement, sanitized)
        redactions += count
    return sanitized, redactions


def detect_prompt_injection(text: str) -> list[str]:
    """Return matched injection heuristic substrings, if any."""
    matches: list[str] = []
    for pattern in INJECTION_PATTERNS:
        found = pattern.search(text)
        if found:
            matches.append(found.group(0))
    return matches


def sanitize_message_content(content: str | list[Any]) -> tuple[str | list[Any], int, list[str]]:
    """
    Sanitize a single message content field.

    Supports string content and OpenAI multimodal list payloads (text parts only).
    """
    if isinstance(content, str):
        redacted, count = _redact_text(content)
        injections = detect_prompt_injection(content)
        return redacted, count, injections

    if not isinstance(content, list):
        return content, 0, []

    updated: list[Any] = []
    total_redactions = 0
    all_injections: list[str] = []

    for part in content:
        if isinstance(part, dict) and part.get("type") == "text":
            text_value = str(part.get("text", ""))
            redacted, count = _redact_text(text_value)
            injections = detect_prompt_injection(text_value)
            total_redactions += count
            all_injections.extend(injections)
            updated.append({**part, "text": redacted})
        else:
            updated.append(part)

    return updated, total_redactions, all_injections


def scan_and_sanitize_messages(
    messages: list[dict[str, Any]],
) -> GuardResult:
    """Apply PII masking and injection detection across chat messages."""
    sanitized_messages: list[dict[str, Any]] = []
    total_redactions = 0
    injection_hits: list[str] = []

    for message in messages:
        msg = dict(message)
        content = msg.get("content")
        if content is None:
            sanitized_messages.append(msg)
            continue

        new_content, redactions, injections = sanitize_message_content(content)
        msg["content"] = new_content
        sanitized_messages.append(msg)
        total_redactions += redactions
        injection_hits.extend(injections)

    return GuardResult(
        messages=sanitized_messages,
        redaction_count=total_redactions,
        injection_detected=bool(injection_hits),
        injection_matches=tuple(dict.fromkeys(injection_hits)),
    )
