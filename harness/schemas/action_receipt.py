"""Universal Action Receipt schema (JSON-serializable)."""

from __future__ import annotations

from typing import Any, Literal, TypedDict

UniversalActionDecision = Literal["ALLOW", "BLOCK", "READ_ONLY", "REQUIRE_APPROVAL"]


class UniversalActionReceipt(TypedDict):
    receipt_id: str
    timestamp: str
    agent: dict[str, Any]
    intent: str
    proposed_action: dict[str, Any]
    policy_evaluated: dict[str, str]
    decision: UniversalActionDecision
    execution_state: dict[str, str]
    evidence_bundle_hash: str
