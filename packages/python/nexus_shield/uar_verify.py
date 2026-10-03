"""Local UAR / Action Receipt cryptographic verification (stdlib only)."""

from __future__ import annotations

import hashlib
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

UAR_V2_HASH_FIELDS = frozenset(
    {"sha256_hash", "signature", "evidence_hash", "evidence_bundle_hash"}
)

OUTCOME_STATUSES = frozenset({"VERIFIED", "UNVERIFIED", "DISCREPANCY"})


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
    return {k: v for k, v in receipt.items() if k not in UAR_V2_HASH_FIELDS}


def canonical_uar_v2_core(receipt: dict[str, Any]) -> dict[str, Any]:
    """Fields sealed by UAR 2.0 SHA-256 (excludes hash/signature fields)."""
    return {
        "uar_version": receipt.get("uar_version", "2.0"),
        "receipt_id": receipt.get("receipt_id"),
        "timestamp": receipt.get("timestamp"),
        "agent_passport": receipt.get("agent_passport"),
        "intent": receipt.get("intent"),
        "action": receipt.get("action"),
        "state_before": receipt.get("state_before"),
        "state_after": receipt.get("state_after"),
        "outcome_verification": receipt.get("outcome_verification"),
        "decision": receipt.get("decision"),
    }


def compute_uar_v2_hash(receipt: dict[str, Any]) -> str:
    core = canonical_uar_v2_core(receipt)
    return _sha256(json.dumps(core, sort_keys=True))


def build_uar_v2_receipt(
    *,
    agent_passport: dict[str, Any],
    intent: str,
    action: dict[str, Any],
    state_before: dict[str, Any],
    state_after: dict[str, Any],
    outcome_verification: dict[str, Any],
    decision: str = "ALLOW",
    receipt_id: str | None = None,
    timestamp: str | None = None,
) -> dict[str, Any]:
    """Build a sealed UAR 2.0 receipt with sha256_hash and signature."""
    ov_status = outcome_verification.get("status")
    if ov_status is not None and str(ov_status) not in OUTCOME_STATUSES:
        raise ValueError(f"invalid outcome_verification.status: {ov_status}")

    ts = timestamp or datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    rid = receipt_id or f"uar2_{uuid.uuid4().hex[:16]}"
    receipt: dict[str, Any] = {
        "uar_version": "2.0",
        "receipt_id": rid,
        "timestamp": ts,
        "agent_passport": agent_passport,
        "intent": intent,
        "action": action,
        "state_before": state_before,
        "state_after": state_after,
        "outcome_verification": outcome_verification,
        "decision": decision,
    }
    digest = compute_uar_v2_hash(receipt)
    receipt["sha256_hash"] = digest
    receipt["signature"] = digest
    return receipt


def _verify_uar_v2(receipt: dict[str, Any]) -> dict[str, Any]:
    errors: list[str] = []
    if receipt.get("uar_version") not in (None, "2.0"):
        errors.append("unsupported uar_version")

    ov = receipt.get("outcome_verification")
    if isinstance(ov, dict):
        st = ov.get("status")
        if st is not None and str(st) not in OUTCOME_STATUSES:
            errors.append("invalid outcome_verification.status")
    elif ov is not None:
        errors.append("outcome_verification must be an object")

    for field in ("agent_passport", "intent", "action", "state_before", "state_after"):
        if field not in receipt:
            errors.append(f"missing required UAR 2.0 field: {field}")

    computed = compute_uar_v2_hash(receipt)
    actual = receipt.get("sha256_hash")
    hash_ok = bool(actual) and computed == actual
    if not hash_ok:
        errors.append("sha256_hash mismatch")

    sig = receipt.get("signature")
    sig_ok = sig is None or sig == actual or sig == computed
    if sig is not None and not sig_ok:
        errors.append("signature does not match sha256_hash")

    valid = hash_ok and sig_ok and not errors
    return {
        "valid": valid,
        "format": "uar_v2",
        "receipt_id": receipt.get("receipt_id"),
        "computed_sha256": computed,
        "stored_sha256": actual,
        "errors": errors,
    }


def _is_uar_v2(receipt: dict[str, Any]) -> bool:
    if receipt.get("uar_version") == "2.0":
        return True
    if receipt.get("sha256_hash") and receipt.get("agent_passport") is not None:
        return True
    return False


def verify_receipt_dict(receipt: dict[str, Any]) -> dict[str, Any]:
    """
    Verify SHA-256 evidence seal and optional signature field.
    Supports UAR 2.0, enterprise UAR v1 (evidence_bundle_hash), and SDK Action Receipt (evidence_hash).
    """
    if _is_uar_v2(receipt):
        return _verify_uar_v2(receipt)

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

    errors.append("missing sha256_hash, evidence_bundle_hash, or evidence_hash")
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
