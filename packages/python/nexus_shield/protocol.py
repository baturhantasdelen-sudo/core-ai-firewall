"""Universal Action Receipt Protocol (UAR 2.0) — schema export and validation."""

from __future__ import annotations

import json
from typing import Any

PROTOCOL_ID = "https://nexusshield.ai/schemas/uar/2.0"
PROTOCOL_VERSION = "2.0"


def export_uar_v2_json_schema() -> dict[str, Any]:
    """Canonical JSON Schema (draft 2020-12) for UAR 2.0 receipts."""
    return {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "$id": PROTOCOL_ID,
        "title": "Universal Action Receipt 2.0",
        "type": "object",
        "required": [
            "uar_version",
            "receipt_id",
            "timestamp",
            "agent_passport",
            "intent",
            "action",
            "state_before",
            "state_after",
            "outcome_verification",
            "decision",
            "sha256_hash",
        ],
        "properties": {
            "uar_version": {"const": "2.0"},
            "receipt_id": {"type": "string", "minLength": 1},
            "timestamp": {"type": "string", "format": "date-time"},
            "agent_passport": {
                "type": "object",
                "required": ["agent_id"],
                "properties": {
                    "agent_id": {"type": "string"},
                    "owner": {"type": "string"},
                    "organization": {"type": "string"},
                    "purpose": {"type": "string"},
                    "risk_level": {"type": "string"},
                    "max_financial_authority": {"type": "number"},
                },
                "additionalProperties": True,
            },
            "intent": {"type": "string"},
            "action": {
                "type": "object",
                "required": ["tool"],
                "properties": {
                    "tool": {"type": "string"},
                    "system": {"type": "string"},
                    "params": {"type": "object"},
                },
                "additionalProperties": True,
            },
            "state_before": {"type": "object"},
            "state_after": {"type": "object"},
            "outcome_verification": {
                "type": "object",
                "required": ["status"],
                "properties": {
                    "status": {"enum": ["VERIFIED", "UNVERIFIED", "DISCREPANCY"]},
                    "reason": {"type": "string"},
                    "agent_claim": {"type": "string"},
                    "actual_status": {"type": "string"},
                },
                "additionalProperties": True,
            },
            "decision": {"enum": ["ALLOW", "BLOCK", "READ_ONLY", "REQUIRE_APPROVAL"]},
            "sha256_hash": {"type": "string", "pattern": "^[a-f0-9]{64}$"},
            "signature": {"type": "string"},
        },
        "additionalProperties": True,
    }


def export_protocol_spec_json() -> str:
    """Open specification bundle for integrators (schema + metadata)."""
    payload = {
        "protocol": "Universal Action Receipt",
        "version": PROTOCOL_VERSION,
        "schema_id": PROTOCOL_ID,
        "json_schema": export_uar_v2_json_schema(),
    }
    return json.dumps(payload, indent=2, sort_keys=True)


def _type_name(value: Any) -> str:
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "boolean"
    if isinstance(value, int) and not isinstance(value, bool):
        return "integer"
    if isinstance(value, float):
        return "number"
    if isinstance(value, str):
        return "string"
    if isinstance(value, list):
        return "array"
    if isinstance(value, dict):
        return "object"
    return "unknown"


def _validate_node(value: Any, schema: dict[str, Any], path: str, errors: list[str]) -> None:
    if "const" in schema and value != schema["const"]:
        errors.append(f"{path}: expected const {schema['const']!r}")
        return

    enum_vals = schema.get("enum")
    if enum_vals is not None and value not in enum_vals:
        errors.append(f"{path}: value not in enum {enum_vals}")
        return

    expected_type = schema.get("type")
    if expected_type:
        actual = _type_name(value)
        if expected_type == "number" and actual in ("integer", "number"):
            pass
        elif actual != expected_type:
            errors.append(f"{path}: expected type {expected_type}, got {actual}")
            return

    if expected_type == "object" or isinstance(value, dict):
        if not isinstance(value, dict):
            return
        for req in schema.get("required") or []:
            if req not in value:
                errors.append(f"{path}: missing required property {req!r}")
        props = schema.get("properties") or {}
        for key, subschema in props.items():
            if key in value:
                _validate_node(value[key], subschema, f"{path}.{key}", errors)
        if schema.get("additionalProperties") is False:
            extra = set(value) - set(props)
            if extra:
                errors.append(f"{path}: unexpected properties {sorted(extra)}")

    if isinstance(value, str):
        min_len = schema.get("minLength")
        if min_len is not None and len(value) < min_len:
            errors.append(f"{path}: string shorter than minLength {min_len}")
        pattern = schema.get("pattern")
        if pattern:
            import re

            if not re.fullmatch(pattern, value):
                errors.append(f"{path}: does not match pattern {pattern}")


def validate_uar_protocol_document(document: dict[str, Any]) -> dict[str, Any]:
    """
    Validate a receipt dict against the exported UAR 2.0 JSON Schema (stdlib validator).
    """
    if not isinstance(document, dict):
        raise TypeError("document must be a dict")
    errors: list[str] = []
    _validate_node(document, export_uar_v2_json_schema(), "$", errors)
    return {"valid": len(errors) == 0, "errors": errors, "protocol_version": PROTOCOL_VERSION}
