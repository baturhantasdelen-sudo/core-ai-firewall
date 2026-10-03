"""In-memory PII and secret redaction for flight recorder exports (stdlib only)."""

from __future__ import annotations

import json
import re
from typing import Any

_EMAIL = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")
_PHONE = re.compile(r"\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b")
_CC = re.compile(r"\b(?:\d[ -]*?){13,19}\b")
_BEARER = re.compile(r"\b(Bearer\s+)[A-Za-z0-9\-._~+/]+=*\b", re.I)
_API_KEY = re.compile(
    r"\b(sk-[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9\-]+|AKIA[A-Z0-9]{16}|"
    r"ghp_[A-Za-z0-9]{36,}|glpat-[A-Za-z0-9\-_]{20,})\b"
)
_GENERIC_SECRET = re.compile(r"(?i)(api[_-]?key|secret|token|password)\s*[:=]\s*['\"]?\S+['\"]?")


def redact_string(text: str) -> str:
    if not text:
        return text
    out = _EMAIL.sub("[REDACTED_EMAIL]", text)
    out = _PHONE.sub("[REDACTED_PHONE]", out)
    out = _CC.sub("[REDACTED_PAN]", out)
    out = _BEARER.sub(r"\1[REDACTED_TOKEN]", out)
    out = _API_KEY.sub("[REDACTED_SECRET]", out)
    out = _GENERIC_SECRET.sub(r"\1=[REDACTED]", out)
    return out


def redact_value(value: Any) -> Any:
    if isinstance(value, str):
        return redact_string(value)
    if isinstance(value, dict):
        return {str(k): redact_value(v) for k, v in value.items()}
    if isinstance(value, list):
        return [redact_value(v) for v in value]
    return value


def redact_json_text(raw: str) -> str:
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return redact_string(raw)
    return json.dumps(redact_value(parsed), ensure_ascii=False)
