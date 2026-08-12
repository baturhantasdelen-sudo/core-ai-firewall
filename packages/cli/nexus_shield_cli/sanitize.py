from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

PII_PATTERNS: dict[str, str] = {
    "TCKN": r"\b[1-9]\d{10}\b",
    "CREDIT_CARD": r"\b(?:\d{4}[-\s]?){3}\d{4}\b|\b(?:\d[ -]*){13,19}\d\b",
    "EMAIL": r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}",
    "PHONE": r"(?:\+?90|0)?\s*[5]\d{2}\s*\d{3}\s*\d{2}\s*\d{2}",
    "API_KEY": (
        r"\b(?:sk-[a-zA-Z0-9]{20,}|ghp_[a-zA-Z0-9]{36}|gho_[a-zA-Z0-9]{36}|"
        r"github_pat_[a-zA-Z0-9_]{22,}|AKIA[0-9A-Z]{16}|xox[baprs]-[a-zA-Z0-9-]{10,})\b"
    ),
}

COMPILED_PII_PATTERNS: dict[str, re.Pattern[str]] = {
    name: re.compile(pattern) for name, pattern in PII_PATTERNS.items()
}


@dataclass
class SanitizeResult:
    text: str
    pii_detected: bool = False
    masked_types: list[str] = field(default_factory=list)


@dataclass
class MaskOptions:
    mask_tckn: bool = True
    mask_credit_card: bool = True
    mask_email: bool = True
    mask_phone: bool = False
    mask_api_key: bool = True

    @classmethod
    def all_enabled(cls) -> MaskOptions:
        return cls(mask_phone=True)


def sanitize_text(text: str, options: MaskOptions) -> SanitizeResult:
    redacted = text
    masked_types: list[str] = []
    enabled = {
        "TCKN": options.mask_tckn,
        "CREDIT_CARD": options.mask_credit_card,
        "EMAIL": options.mask_email,
        "PHONE": options.mask_phone,
        "API_KEY": options.mask_api_key,
    }

    for label, pattern in COMPILED_PII_PATTERNS.items():
        if not enabled.get(label, False):
            continue
        if pattern.search(redacted):
            masked_types.append(label)
            redacted = pattern.sub(f"[{label}_REDACTED]", redacted)

    return SanitizeResult(
        text=redacted,
        pii_detected=bool(masked_types),
        masked_types=masked_types,
    )


def _sanitize_string(value: str, options: MaskOptions) -> tuple[str, list[str]]:
    result = sanitize_text(value, options)
    return result.text, result.masked_types


def sanitize_chat_payload(payload: dict[str, Any], options: MaskOptions) -> tuple[dict[str, Any], list[str]]:
    sanitized = dict(payload)
    masked_types: list[str] = []

    messages = sanitized.get("messages")
    if isinstance(messages, list):
        new_messages: list[Any] = []
        for message in messages:
            if not isinstance(message, dict):
                new_messages.append(message)
                continue
            updated = dict(message)
            content = updated.get("content")
            if isinstance(content, str):
                updated["content"], found = _sanitize_string(content, options)
                masked_types.extend(found)
            elif isinstance(content, list):
                updated_blocks: list[Any] = []
                for block in content:
                    if isinstance(block, dict) and block.get("type") == "text":
                        block_copy = dict(block)
                        text = block_copy.get("text")
                        if isinstance(text, str):
                            block_copy["text"], found = _sanitize_string(text, options)
                            masked_types.extend(found)
                        updated_blocks.append(block_copy)
                    else:
                        updated_blocks.append(block)
                updated["content"] = updated_blocks
            new_messages.append(updated)
        sanitized["messages"] = new_messages

    for key in ("prompt", "input"):
        value = sanitized.get(key)
        if isinstance(value, str):
            sanitized[key], found = _sanitize_string(value, options)
            masked_types.extend(found)

    return sanitized, sorted(set(masked_types))
