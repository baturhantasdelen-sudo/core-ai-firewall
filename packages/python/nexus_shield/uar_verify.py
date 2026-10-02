"""Local UAR / Action Receipt cryptographic verification (stdlib only)."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any


def _sha256(payload: str) -> str:
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _canonical_enterprise_core(receipt: dict[str, Any]) -> dict[str, Any]:
    return {
        "receipt_id": receipt.get("receipt_id"),
        "timestamp": receipt.get("timestamp"),
        "agent": receipt.get("agent"),
        "intent": receipt.get("intent"),
        "proposed_action": receipt.get("proposed_action"),
        "policy_evaluated": receipt.get("policy_evaluated"),
        "decision": receipt.get("decision"),
        "execution_state": receipt.get("execution_state"),
    }


def _canonical_sdk_core(receipt: dict[str, Any]) -> dict[str, Any]:
    excluded = {"evidence_hash", "signature"}
    return {k: v for k, v in receipt.items() if k not in excluded}


def verify_receipt_dict(receipt: dict[str, Any]) -> dict[str, Any]:
    """
    Verify SHA-256 evidence seal and optional signature field.
    Supports enterprise UAR (evidence_bundle_hash) and SDK Action Receipt (evidence_hash).
    """
    errors: list[str] = []

    if receipt.get("evidence_bundle_hash"):
        core = _canonical_enterprise_core(receipt)
        computed = _sha256(json.dumps(core, sort_keys=True))
        actual = receipt.get("evidence_bundle_hash")
        hash_ok = bool(actual) and computed == actual
        if not hash_ok:
            errors.append("evidence_bundle_hash mismatch")
        sig = receipt.get("signature")
        sig_ok = sig is None or sig == actual or sig == computed
        if sig is not None and not sig_ok:
            errors.append("signature does not match evidence_bundle_hash")
        valid = hash_ok and sig_ok
        return {
            "valid": valid,
            "format": "enterprise_uar",
            "receipt_id": receipt.get("receipt_id"),
            "computed_sha256": computed,
            "stored_sha256": actual,
            "errors": errors,
        }

    if receipt.get("evidence_hash"):
        core = _canonical_sdk_core(receipt)
        computed = _sha256(json.dumps(core, sort_keys=True))
        actual = receipt.get("evidence_hash")
        hash_ok = bool(actual) and computed == actual
        if not hash_ok:
            errors.append("evidence_hash mismatch")
        sig = receipt.get("signature")
        sig_ok = sig is None or sig == actual or sig == computed
        if sig is not None and not sig_ok:
            errors.append("signature does not match evidence_hash")
        valid = hash_ok and sig_ok
        return {
            "valid": valid,
            "format": "sdk_action_receipt",
            "receipt_id": receipt.get("action_id") or receipt.get("receipt_id"),
            "computed_sha256": computed,
            "stored_sha256": actual,
            "errors": errors,
        }

    errors.append("missing evidence_bundle_hash or evidence_hash")
    return {"valid": False, "format": "unknown", "errors": errors}


def load_receipt_path(path: Path) -> dict[str, Any]:
    if not path.is_file():
        raise FileNotFoundError(str(path))
    raw = path.read_text(encoding="utf-8")
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid JSON in {path}: {exc}") from exc
    if not isinstance(data, dict):
        raise ValueError("Receipt root must be a JSON object")
    if "universal_action_receipt" in data and isinstance(data["universal_action_receipt"], dict):
        return data["universal_action_receipt"]
    return data


def verify_receipt_file(path: Path) -> dict[str, Any]:
    receipt = load_receipt_path(path)
    return verify_receipt_dict(receipt)
