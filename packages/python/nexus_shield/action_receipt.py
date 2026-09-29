"""Standard Action Receipt API — maps runtime decisions to SDK-friendly UAR JSON."""

from __future__ import annotations

import hashlib
import json
import uuid
from datetime import datetime, timezone
from typing import Any, Literal

Authorization = Literal["approved", "blocked", "read_only", "approval_required"]
PolicyResult = Literal["passed", "failed"]
ExecutionResult = Literal["success", "failure", "blocked", "pending"]


def _sha256(payload: str) -> str:
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def decision_to_authorization(decision: str) -> Authorization:
    mapping = {
        "ALLOW": "approved",
        "BLOCK": "blocked",
        "READ_ONLY": "read_only",
        "REQUIRE_APPROVAL": "approval_required",
        "HUMAN_APPROVAL_REQUIRED": "approval_required",
    }
    return mapping.get(decision.upper(), "blocked")


def build_action_receipt(
    *,
    agent_id: str,
    intent: str,
    tool_name: str,
    tool_params: dict[str, Any] | None = None,
    decision: str = "BLOCK",
    rule_id: str = "POLICY_EVAL",
    before_state_hash: str | None = None,
    after_state_hash: str | None = None,
    action_id: str | None = None,
    timestamp: str | None = None,
) -> dict[str, Any]:
    """Build standard Action Receipt API JSON (local testing / SDK responses)."""
    ts = timestamp or datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    aid = action_id or f"uar_{uuid.uuid4().hex[:16]}"
    auth = decision_to_authorization(decision)
    policy: PolicyResult = "passed" if auth == "approved" else "failed"
    if auth == "read_only":
        policy = "passed"
    execution: ExecutionResult = "blocked" if auth == "blocked" else "pending"
    if auth == "approved":
        execution = "success"

    before = before_state_hash or _sha256(f"before:{agent_id}:{tool_name}")
    after = after_state_hash or _sha256(f"after:{agent_id}:{decision}")

    core = {
        "action_id": aid,
        "agent_id": agent_id,
        "intent": intent,
        "tool": {"name": tool_name, "params": tool_params or {}},
        "authorization": auth,
        "policy": policy,
        "execution": execution,
        "before_state_hash": before,
        "after_state_hash": after,
        "timestamp": ts,
        "policy_evaluated": {"rule_id": rule_id, "decision": decision},
    }
    evidence_hash = _sha256(json.dumps(core, sort_keys=True))
    core["evidence_hash"] = evidence_hash
    core["signature"] = evidence_hash
    return core


def inspect_action(
    *,
    agent_id: str,
    user_intent: str,
    tool_name: str,
    tool_params: dict[str, Any] | None = None,
    data_plane_url: str = "http://127.0.0.1:8090",
) -> dict[str, Any]:
    """
    Call local data plane intercept when available; otherwise return deterministic mock receipt.
    """
    import urllib.error
    import urllib.request

    body = json.dumps(
        {
            "tenant_id": "tnt_default",
            "agent_id": agent_id,
            "user_intent": user_intent,
            "tool": tool_name,
            "params": tool_params or {},
        }
    ).encode("utf-8")
    req = urllib.request.Request(
        f"{data_plane_url.rstrip('/')}/v1/intercept",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
        receipt = payload.get("universal_action_receipt") or {}
        uar = payload.get("uar") or {}
        decision = payload.get("decision") or receipt.get("decision") or "BLOCK"
        return build_action_receipt(
            agent_id=agent_id,
            intent=user_intent,
            tool_name=tool_name,
            tool_params=tool_params,
            decision=str(decision),
            rule_id=(receipt.get("policy_evaluated") or {}).get("rule_id", "RUNTIME"),
            before_state_hash=(receipt.get("execution_state") or {}).get("before_hash"),
            after_state_hash=(receipt.get("execution_state") or {}).get("after_hash"),
            action_id=receipt.get("receipt_id") or uar.get("receipt_id"),
            timestamp=receipt.get("timestamp"),
        )
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
        return build_action_receipt(
            agent_id=agent_id,
            intent=user_intent,
            tool_name=tool_name,
            tool_params=tool_params,
            decision="BLOCK",
            rule_id="MOCK_OFFLINE",
        )
