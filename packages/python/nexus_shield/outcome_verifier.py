"""Outcome verification — agent claim vs execution result and system state."""

from __future__ import annotations

from typing import Any, Literal

OutcomeStatus = Literal["VERIFIED", "UNVERIFIED", "DISCREPANCY"]


def _normalize_claim(claim: str) -> str:
    return claim.strip().upper().replace(" ", "_")


def _extract_actual_status(
    execution_result: dict[str, Any],
    system_state_after: dict[str, Any],
) -> str | None:
    if execution_result.get("status"):
        return _normalize_claim(str(execution_result["status"]))
    code = execution_result.get("status_code")
    if code is not None:
        try:
            c = int(code)
        except (TypeError, ValueError):
            c = None
        if c is not None:
            if 200 <= c < 300:
                body = execution_result.get("body") or {}
                if isinstance(body, dict) and body.get("status"):
                    return _normalize_claim(str(body["status"]))
                return "SUCCESS"
            if c >= 400:
                return "FAILED"
    state_status = system_state_after.get("status") or system_state_after.get("payment_status")
    if state_status:
        return _normalize_claim(str(state_status))
    return None


def _state_changed(state_before: dict[str, Any], state_after: dict[str, Any]) -> bool:
    if not state_before and not state_after:
        return False
    return state_before != state_after


def verify_outcome(
    agent_claim: str,
    execution_result: dict[str, Any],
    system_state_after: dict[str, Any],
    *,
    state_before: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Compare agent-stated outcome with API execution and post-action system state.

    Returns dict with ``status`` in ``VERIFIED`` | ``UNVERIFIED`` | ``DISCREPANCY``.
    """
    if not agent_claim or not isinstance(agent_claim, str):
        raise ValueError("agent_claim must be a non-empty string")
    if not isinstance(execution_result, dict):
        raise ValueError("execution_result must be a dict")
    if not isinstance(system_state_after, dict):
        raise ValueError("system_state_after must be a dict")

    claim_norm = _normalize_claim(agent_claim)
    actual = _extract_actual_status(execution_result, system_state_after)

    details: dict[str, Any] = {
        "agent_claim": claim_norm,
        "actual_status": actual,
        "state_changed": _state_changed(state_before or {}, system_state_after),
    }

    if actual is None:
        return {**details, "status": "UNVERIFIED", "reason": "could not derive actual status"}

    claim_aliases = {claim_norm}
    if claim_norm == "PAID":
        claim_aliases.update({"SUCCESS", "PAYMENT_POSTED", "COMPLETED"})
    if claim_norm == "READ":
        claim_aliases.update({"SUCCESS", "OK", "FETCHED"})

    if claim_norm == actual or actual in claim_aliases or claim_norm in {actual}:
        if state_before is not None and not details["state_changed"] and claim_norm in {"PAID", "DELETED", "UPDATED"}:
            return {
                **details,
                "status": "DISCREPANCY",
                "reason": "claim implies mutation but state_before equals state_after",
            }
        return {**details, "status": "VERIFIED", "reason": "claim matches execution and state"}

    return {
        **details,
        "status": "DISCREPANCY",
        "reason": f"claim {claim_norm} does not match actual {actual}",
    }
