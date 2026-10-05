"""High-level SDK: verify_action(agent, intent, action, authority)."""

from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass
from typing import Any, Literal

Decision = Literal["BLOCK", "ALLOW", "REQUIRE_APPROVAL"]


class SecurityException(Exception):
    def __init__(self, message: str, *, decision: str, reason: str, risk_score: float) -> None:
        super().__init__(message)
        self.decision = decision
        self.reason = reason
        self.risk_score = risk_score


@dataclass
class VerifyActionResult:
    block: bool
    allow: bool
    require_approval: bool
    decision: Decision
    reason: str
    risk_score: float
    intent_divergence_percent: float
    action_proof_hash: str
    receipt_id: str


def _sha256_digest(value: Any) -> str:
    if isinstance(value, str):
        payload = value
    else:
        payload = json.dumps(value, sort_keys=True, separators=(",", ":"))
    return "sha256:" + hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _normalize_intent(intent: str) -> str:
    return re.sub(r"\s+", "_", intent.strip().upper())


def _intent_divergence(intent: str, tool_name: str) -> float:
    intent_n = intent.lower()
    tool_n = tool_name.lower()
    if "invoice" in intent_n and "invoice" in tool_n:
        return 5.0
    if "payment" in intent_n and "payment" in tool_n:
        return 8.0
    if "export" in intent_n and "export" in tool_n:
        return 12.0
    if any(w in intent_n for w in ("read", "retrieve", "get")) and any(
        w in tool_n for w in ("read", "get", "fetch", "retrieve")
    ):
        return 15.0
    return 55.0


def _policy_block(intent: str, tool_name: str, authority: list[str]) -> str | None:
    intent_u = _normalize_intent(intent)
    tool_u = tool_name.upper()
    blocked = ("EXPORT_CUSTOMER_DATABASE", "DELETE_RECORD")
    for rule in blocked:
        if rule in intent_u or rule in tool_u:
            return f"blocked_actions: {rule}"
    if authority:
        allowed = [a.upper() for a in authority]
        if "READ_INVOICE" in allowed and "INVOICE" in intent_u:
            return None
    return None


def verify_action(
    *,
    agent: str,
    intent: str,
    action: dict[str, Any],
    authority: list[str],
    policy: dict[str, Any] | None = None,
    transaction_id: str | None = None,
) -> VerifyActionResult:
    """
    Python SDK stub aligned with Node `verifyAction`.

    Example:
        decision = verify_action(
            agent="finance-agent-04",
            intent="retrieve_invoice_8291",
            action=tool_call,
            authority=agent_permissions,
        )
        if decision.block:
            raise SecurityException(decision.reason, ...)
    """
    tool_name = str(action.get("name") or action.get("tool") or "unknown_tool")
    tool_args = action.get("args") if isinstance(action.get("args"), dict) else {}

    policy_doc = policy or {"agent": agent, "allowed_intents": authority}
    block_reason = _policy_block(intent, tool_name, authority)
    divergence = _intent_divergence(intent, tool_name)

    txn = transaction_id or f"TXN-{agent}"
    action_proof_hash = _sha256_digest(
        {
            "intentHash": _sha256_digest({"intent": intent}),
            "policyHash": _sha256_digest(policy_doc),
            "toolCallHash": _sha256_digest({"name": tool_name, "args": tool_args}),
            "transactionId": txn,
            "resultHash": _sha256_digest({}),
        }
    )

    risk_score = min(100.0, divergence + (40.0 if block_reason else 0.0))
    decision: Decision = "ALLOW"
    reason = "OK"

    if block_reason:
        decision = "BLOCK"
        reason = block_reason
    elif divergence >= 70:
        decision = "BLOCK"
        reason = "intent vs action divergence threshold exceeded"
    elif divergence >= 45:
        decision = "REQUIRE_APPROVAL"
        reason = "elevated intent divergence — approval required"

    amount = tool_args.get("amount")
    if policy and amount is not None:
        try:
            amt = float(amount)
            for rule in policy.get("requires_approval") or []:
                if isinstance(rule, str) and "CREATE_PAYMENT" in rule.upper() and amt > 10000:
                    decision = "REQUIRE_APPROVAL"
                    reason = rule
        except (TypeError, ValueError):
            pass

    result = VerifyActionResult(
        block=decision == "BLOCK",
        allow=decision == "ALLOW",
        require_approval=decision == "REQUIRE_APPROVAL",
        decision=decision,
        reason=reason,
        risk_score=risk_score,
        intent_divergence_percent=divergence,
        action_proof_hash=action_proof_hash,
        receipt_id=f"aar_{hashlib.sha256(agent.encode()).hexdigest()[:24]}",
    )

    if result.block:
        raise SecurityException(
            f"Action blocked: {reason}",
            decision=decision,
            reason=reason,
            risk_score=risk_score,
        )

    return result
