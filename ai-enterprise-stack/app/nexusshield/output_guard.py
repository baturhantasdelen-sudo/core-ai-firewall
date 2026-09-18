"""NexusShield V2 — LLM output scanning and sensitive data redaction."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from typing import Any

from app.nexusshield.guard import CREDIT_CARD_PATTERN, EMAIL_PATTERN, PHONE_PATTERN

SECRET_KEY_PATTERN = re.compile(
    r"\b(sk-[A-Za-z0-9_-]{10,}|"
    r"AKIA[0-9A-Z]{16}|"
    r"ghp_[A-Za-z0-9]{20,}|"
    r"xox[baprs]-[A-Za-z0-9-]{10,})\b"
)

CREDENTIAL_ASSIGNMENT_PATTERN = re.compile(
    r"(?i)\b(api[_-]?key|secret|password|token|authorization)\s*[:=]\s*\S+"
)

OUTPUT_REDACTIONS: tuple[tuple[re.Pattern[str], str], ...] = (
    (EMAIL_PATTERN, "[REDACTED_EMAIL]"),
    (PHONE_PATTERN, "[REDACTED_PHONE]"),
    (CREDIT_CARD_PATTERN, "[REDACTED_CREDIT_CARD]"),
    (SECRET_KEY_PATTERN, "[REDACTED_SECRET]"),
    (CREDENTIAL_ASSIGNMENT_PATTERN, "[REDACTED_CREDENTIAL]"),
)


@dataclass(frozen=True, slots=True)
class OutputGuardResult:
    """Outcome of scanning an upstream LLM completion payload."""

    payload: dict[str, Any]
    redaction_count: int
    violations: tuple[str, ...] = field(default_factory=tuple)


def _redact_output_text(text: str) -> tuple[str, int, list[str]]:
    redactions = 0
    violations: list[str] = []
    sanitized = text

    for pattern, replacement in OUTPUT_REDACTIONS:
        sanitized, count = pattern.subn(replacement, sanitized)
        if count:
            redactions += count
            violations.append(replacement.strip("[]"))

    return sanitized, redactions, violations


def _sanitize_choice_content(content: str | list[Any] | None) -> tuple[str | list[Any] | None, int, list[str]]:
    if content is None:
        return None, 0, []
    if isinstance(content, str):
        return _redact_output_text(content)
    if not isinstance(content, list):
        return content, 0, []

    updated: list[Any] = []
    total_redactions = 0
    all_violations: list[str] = []

    for part in content:
        if isinstance(part, dict) and part.get("type") == "text":
            redacted, count, violations = _redact_output_text(str(part.get("text", "")))
            updated.append({**part, "text": redacted})
            total_redactions += count
            all_violations.extend(violations)
        else:
            updated.append(part)

    return updated, total_redactions, all_violations


def scan_and_sanitize_completion(payload: dict[str, Any]) -> OutputGuardResult:
    """
    Scan OpenAI-style chat completion JSON and redact leaked sensitive data
    from assistant message content before returning to the client.
    """
    if not isinstance(payload, dict):
        return OutputGuardResult(payload={"error": "invalid_payload"}, redaction_count=0)

    sanitized = json.loads(json.dumps(payload))
    total_redactions = 0
    violation_hits: list[str] = []

    choices = sanitized.get("choices")
    if isinstance(choices, list):
        for choice in choices:
            if not isinstance(choice, dict):
                continue
            message = choice.get("message")
            if not isinstance(message, dict):
                continue
            new_content, count, violations = _sanitize_choice_content(message.get("content"))
            message["content"] = new_content
            total_redactions += count
            violation_hits.extend(violations)

    return OutputGuardResult(
        payload=sanitized,
        redaction_count=total_redactions,
        violations=tuple(dict.fromkeys(violation_hits)),
    )
