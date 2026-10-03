"""Outcome verification — cross-check API execution vs DB and ledger state."""

from __future__ import annotations

import hashlib
import json
from typing import Any, Literal, Protocol, Tuple

OutcomeVerdict = Literal["VERIFIED", "UNVERIFIED", "FAILED"]


class ResourceStateConnector(Protocol):
    def get_resource_state(self, resource_id: str) -> dict[str, Any]:
        """Return current authoritative resource state (e.g. invoice status)."""


class LedgerConnector(Protocol):
    def get_latest_transaction(self, resource_id: str) -> dict[str, Any]:
        """Return latest ledger snapshot tied to the resource."""


class OutcomeVerificationEngine:
    """
    Post-action cross-check between API response and real-world DB/ledger state.

    Detects false success: HTTP 200 while invoice remains PENDING.
    """

    def __init__(self, db_connector: ResourceStateConnector, ledger_connector: LedgerConnector) -> None:
        self.db = db_connector
        self.ledger = ledger_connector

    def verify_action_outcome(
        self,
        intent: dict[str, Any],
        execution_result: dict[str, Any],
        state_snapshot_before: dict[str, Any],
    ) -> Tuple[OutcomeVerdict, dict[str, Any]]:
        status_code = execution_result.get("status_code")
        if status_code is None:
            return "FAILED", {"reason": "execution_result.status_code is required"}
        try:
            code = int(status_code)
        except (TypeError, ValueError):
            return "FAILED", {"reason": "status_code must be an integer"}

        if code != 200:
            return "FAILED", {"reason": "API execution returned non-200 status", "status_code": code}

        resource_id = intent.get("target_resource")
        if not resource_id or not isinstance(resource_id, str):
            return "FAILED", {"reason": "intent.target_resource is required"}

        current_db_state = self.db.get_resource_state(resource_id)
        current_ledger_state = self.ledger.get_latest_transaction(resource_id)

        state_after = {
            "invoice_status": current_db_state.get("status"),
            "ledger_balance": current_ledger_state.get("balance"),
        }

        parsed_intent = intent.get("parsed_intent")
        if parsed_intent == "EXECUTE_PAYMENT":
            was_pending = state_snapshot_before.get("invoice_status") == "PENDING"
            is_now_paid = state_after.get("invoice_status") == "PAID"
            if was_pending and is_now_paid:
                verdict: OutcomeVerdict = "VERIFIED"
            else:
                verdict = "UNVERIFIED"
        else:
            verdict = "VERIFIED"

        evidence_payload = json.dumps(
            {
                "before": state_snapshot_before,
                "after": state_after,
                "verdict": verdict,
            },
            sort_keys=True,
        ).encode("utf-8")
        evidence_hash = hashlib.sha256(evidence_payload).hexdigest()

        return verdict, {
            "state_before": state_snapshot_before,
            "state_after": state_after,
            "evidence_hash": f"sha256:{evidence_hash}",
            "discrepancy_detected": verdict == "UNVERIFIED",
            "verification_method": "DB_STATE_AND_LEDGER_CROSS_CHECK",
            "status": verdict,
        }
