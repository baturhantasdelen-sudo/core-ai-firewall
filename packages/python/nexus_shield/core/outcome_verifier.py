"""Outcome verification — consequential actions registry and state cross-check."""

from __future__ import annotations

import hashlib
import json
from enum import Enum
from typing import Any, Literal, Protocol, Tuple

from nexus_shield.core.aar import compute_evidence_hash, hash_state_snapshot

OutcomeVerdict = Literal["VERIFIED", "UNVERIFIED", "FAILED"]


class ConsequentialAction(str, Enum):
    PAYMENT = "PAYMENT"
    REFUND = "REFUND"
    DELETE = "DELETE"
    TRANSFER = "TRANSFER"
    DEPLOY = "DEPLOY"
    MERGE = "MERGE"
    ACCESS_GRANT = "ACCESS_GRANT"
    CUSTOMER_UPDATE = "CUSTOMER_UPDATE"


# Parsed intents / tool names mapped to consequential action classes.
CONSEQUENTIAL_ACTION_REGISTRY: dict[str, ConsequentialAction] = {
    "EXECUTE_PAYMENT": ConsequentialAction.PAYMENT,
    "PROCESS_PAYMENT": ConsequentialAction.PAYMENT,
    "PROCESS_REFUND": ConsequentialAction.REFUND,
    "ISSUE_REFUND": ConsequentialAction.REFUND,
    "DELETE_RESOURCE": ConsequentialAction.DELETE,
    "DELETE_RECORD": ConsequentialAction.DELETE,
    "TRANSFER_FUNDS": ConsequentialAction.TRANSFER,
    "STRIPE_CREATE_TRANSFER": ConsequentialAction.TRANSFER,
    "DEPLOY_SERVICE": ConsequentialAction.DEPLOY,
    "MERGE_PULL_REQUEST": ConsequentialAction.MERGE,
    "GRANT_ACCESS": ConsequentialAction.ACCESS_GRANT,
    "UPDATE_CUSTOMER": ConsequentialAction.CUSTOMER_UPDATE,
}

MANDATORY_STATE_VERIFICATION: frozenset[ConsequentialAction] = frozenset(ConsequentialAction)


class ResourceStateConnector(Protocol):
    def get_resource_state(self, resource_id: str) -> dict[str, Any]:
        """Return current authoritative resource state (e.g. invoice status)."""


class LedgerConnector(Protocol):
    def get_latest_transaction(self, resource_id: str) -> dict[str, Any]:
        """Return latest ledger snapshot tied to the resource."""


def resolve_consequential_action(parsed_intent: str) -> ConsequentialAction | None:
    key = parsed_intent.strip().upper().replace("-", "_")
    if key in CONSEQUENTIAL_ACTION_REGISTRY:
        return CONSEQUENTIAL_ACTION_REGISTRY[key]
    for registry_key, action in CONSEQUENTIAL_ACTION_REGISTRY.items():
        if registry_key in key or key in registry_key:
            return action
    return None


class OutcomeVerifier:
    """
    Cross-check API execution vs authoritative connectors.

    HTTP 200 alone is insufficient for consequential actions — state must transition.
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

        parsed_intent = str(intent.get("parsed_intent") or "")
        action_class = resolve_consequential_action(parsed_intent)
        resource_id = intent.get("target_resource")
        external_tx = execution_result.get("external_transaction_id") or execution_result.get("transaction_id")

        if code != 200:
            return "FAILED", {
                "reason": "API execution returned non-200 status",
                "status_code": code,
                "consequential_action": action_class.value if action_class else None,
            }

        if action_class in MANDATORY_STATE_VERIFICATION:
            if not resource_id or not isinstance(resource_id, str):
                return "FAILED", {
                    "reason": "intent.target_resource is required for consequential actions",
                    "consequential_action": action_class.value,
                }
        elif not resource_id or not isinstance(resource_id, str):
            # Non-consequential intents may omit deep state verification.
            before_hash = hash_state_snapshot(state_snapshot_before)
            after_hash = hash_state_snapshot(state_snapshot_before)
            return "VERIFIED", {
                "state_before": state_snapshot_before,
                "state_after": state_snapshot_before,
                "state_before_hash": before_hash,
                "state_after_hash": after_hash,
                "external_transaction_id": external_tx,
                "discrepancy_detected": False,
                "verification_method": "API_ONLY",
                "status": "VERIFIED",
                "consequential_action": None,
            }

        current_db_state = self.db.get_resource_state(resource_id)
        current_ledger_state = self.ledger.get_latest_transaction(resource_id)

        state_after = {
            "invoice_status": current_db_state.get("status"),
            "ledger_balance": current_ledger_state.get("balance"),
        }

        verdict: OutcomeVerdict
        if parsed_intent == "EXECUTE_PAYMENT" or action_class == ConsequentialAction.PAYMENT:
            was_pending = state_snapshot_before.get("invoice_status") == "PENDING"
            is_now_paid = state_after.get("invoice_status") == "PAID"
            verdict = "VERIFIED" if was_pending and is_now_paid else "UNVERIFIED"
        elif action_class in (ConsequentialAction.REFUND, ConsequentialAction.TRANSFER):
            before_bal = state_snapshot_before.get("ledger_balance")
            after_bal = state_after.get("ledger_balance")
            verdict = "VERIFIED" if before_bal != after_bal else "UNVERIFIED"
        elif action_class == ConsequentialAction.DELETE:
            was_present = state_snapshot_before.get("resource_present", True)
            is_gone = current_db_state.get("status") == "DELETED" or current_db_state.get("deleted") is True
            verdict = "VERIFIED" if was_present and is_gone else "UNVERIFIED"
        else:
            before_hash_raw = json.dumps(state_snapshot_before, sort_keys=True).encode()
            after_hash_raw = json.dumps(state_after, sort_keys=True).encode()
            verdict = "VERIFIED" if before_hash_raw != after_hash_raw else "UNVERIFIED"

        state_before_hash = hash_state_snapshot(state_snapshot_before)
        state_after_hash = hash_state_snapshot(state_after)
        evidence_payload = json.dumps(
            {
                "before_hash": state_before_hash,
                "after_hash": state_after_hash,
                "verdict": verdict,
                "action": action_class.value if action_class else None,
            },
            sort_keys=True,
        ).encode("utf-8")
        evidence_hash = hashlib.sha256(evidence_payload).hexdigest()

        return verdict, {
            "state_before": state_snapshot_before,
            "state_after": state_after,
            "state_before_hash": state_before_hash,
            "state_after_hash": state_after_hash,
            "external_transaction_id": external_tx,
            "evidence_hash": f"sha256:{evidence_hash}",
            "discrepancy_detected": verdict == "UNVERIFIED",
            "verification_method": "DB_STATE_AND_LEDGER_CROSS_CHECK",
            "status": verdict,
            "consequential_action": action_class.value if action_class else None,
        }


# Backward-compatible alias used by existing imports.
OutcomeVerificationEngine = OutcomeVerifier
