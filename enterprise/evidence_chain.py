"""
Cryptographic UAR evidence chain — Intent → Action → Policy → Decision → Execution → State → SHA-256.

This module formalizes stages and verification for Universal Action Receipts (UAR).
"""

from __future__ import annotations

import hashlib
import json
from typing import Any, Literal

EvidenceStage = Literal[
    "intent_captured",
    "action_proposed",
    "policy_evaluated",
    "decision_recorded",
    "tool_execution",
    "state_change",
    "uar_sealed",
]

STAGE_ORDER: tuple[EvidenceStage, ...] = (
    "intent_captured",
    "action_proposed",
    "policy_evaluated",
    "decision_recorded",
    "tool_execution",
    "state_change",
    "uar_sealed",
)


def _sha256(payload: str) -> str:
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def canonical_receipt_core(receipt: dict[str, Any]) -> dict[str, Any]:
    """Receipt fields included in evidence bundle hash (excludes evidence_bundle_hash)."""
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


def compute_evidence_bundle_hash(receipt: dict[str, Any]) -> str:
    core = canonical_receipt_core(receipt)
    return _sha256(json.dumps(core, sort_keys=True))


def verify_uar_receipt(receipt: dict[str, Any]) -> dict[str, Any]:
    """
    Validate that evidence_bundle_hash matches canonical receipt core.
    Returns verification result for Proof Center / auditors.
    """
    expected = compute_evidence_bundle_hash(receipt)
    actual = receipt.get("evidence_bundle_hash")
    valid = bool(actual) and expected == actual
    return {
        "valid": valid,
        "receipt_id": receipt.get("receipt_id"),
        "evidence_bundle_sha256": actual,
        "computed_sha256": expected,
        "decision": receipt.get("decision"),
        "policy_rule_id": (receipt.get("policy_evaluated") or {}).get("rule_id"),
    }


def build_evidence_chain_record(
    *,
    intent: str,
    tool: str,
    params: dict[str, Any],
    evaluation: dict[str, Any],
    execution_outcome: Literal["blocked", "executed", "not_run"] = "not_run",
    after_state_payload: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Structured stage timeline for SIEM / compliance export."""
    receipt = evaluation.get("receipt") or {}
    decision = evaluation.get("decision") or receipt.get("decision")
    stages: list[dict[str, Any]] = [
        {"stage": "intent_captured", "intent": intent},
        {"stage": "action_proposed", "tool": tool, "params": params},
        {
            "stage": "policy_evaluated",
            "rule_id": evaluation.get("rule_id"),
            "risk_score": evaluation.get("risk_score"),
            "violations": evaluation.get("violations"),
        },
        {"stage": "decision_recorded", "decision": decision},
    ]
    if decision == "BLOCK":
        stages.append({"stage": "tool_execution", "outcome": "blocked", "executed": False})
        stages.append({"stage": "state_change", "outcome": "no_mutation", "after_hash": receipt.get("execution_state", {}).get("after_hash")})
    elif execution_outcome == "executed":
        stages.append({"stage": "tool_execution", "outcome": "executed", "executed": True})
        after_hash = _sha256(json.dumps(after_state_payload or {"tool": tool, "status": "ok"}, sort_keys=True))
        stages.append({"stage": "state_change", "outcome": "mutated", "after_hash": after_hash})
    else:
        stages.append({"stage": "tool_execution", "outcome": "pending", "executed": False})

    verification = verify_uar_receipt(receipt) if receipt else {"valid": False}
    stages.append(
        {
            "stage": "uar_sealed",
            "receipt_id": receipt.get("receipt_id"),
            "evidence_bundle_sha256": receipt.get("evidence_bundle_hash"),
            "cryptographic_valid": verification.get("valid"),
        }
    )
    return {
        "stages": stages,
        "stage_order": list(STAGE_ORDER),
        "verification": verification,
        "universal_action_receipt": receipt,
    }


def finalize_receipt_execution_state(
    receipt: dict[str, Any],
    *,
    executed: bool,
    after_payload: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Update after_hash when a tool actually runs (ALLOW path).
    Recomputes evidence_bundle_hash for a sealed UAR reflecting post-execution state.
    """
    updated = dict(receipt)
    exec_state = dict(updated.get("execution_state") or {})
    if executed:
        exec_state["after_hash"] = _sha256(json.dumps(after_payload or {"executed": True}, sort_keys=True))
        exec_state["execution_status"] = "completed"
    else:
        exec_state["execution_status"] = "blocked"
    updated["execution_state"] = exec_state
    core = canonical_receipt_core(updated)
    updated["evidence_bundle_hash"] = _sha256(json.dumps(core, sort_keys=True))
    return updated
