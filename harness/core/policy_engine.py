"""
Adaptive agent action policy engine — ALLOW / BLOCK / READ_ONLY / REQUIRE_APPROVAL.
"""

from __future__ import annotations

import hashlib
import json
import uuid
from datetime import datetime, timezone
from typing import Any, Literal

AdaptiveDecision = Literal["ALLOW", "BLOCK", "READ_ONLY", "REQUIRE_APPROVAL"]

HIGH_RISK_TOOLS = frozenset(
    {"query", "write_file", "export_customer_database", "list_repo_secrets", "merge_pull_request", "fetch"}
)
EXFIL_PATTERN = ("exfil", "webhook", "select * from", "curl", "../")


def _sha256(payload: str) -> str:
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def evaluate_proposed_action(
    *,
    agent_id: str,
    intent: str,
    tool: str,
    params: dict[str, Any] | None = None,
    identity_verified: bool = True,
) -> dict[str, Any]:
    params = params or {}
    blob = f"{tool} {json.dumps(params, sort_keys=True)}".lower()
    risk = 0
    violations: list[str] = []

    if tool in HIGH_RISK_TOOLS:
        risk += 35
        violations.append(f"HIGH_RISK_TOOL:{tool}")
    if any(p in blob for p in EXFIL_PATTERN):
        risk += 40
        violations.append("EXFIL_PATTERN")
    if "invoice" in intent.lower() and "export" in tool.lower():
        risk += 45
        violations.append("INTENT_ACTION_DIVERGENCE")

    if risk >= 85:
        decision: AdaptiveDecision = "BLOCK"
        rule_id = "POLICY_BLOCK_CRITICAL"
    elif risk >= 65:
        decision = "REQUIRE_APPROVAL"
        rule_id = "POLICY_HITL_ESCALATION"
    elif risk >= 40:
        decision = "READ_ONLY"
        rule_id = "POLICY_ADAPTIVE_READ_ONLY"
    else:
        decision = "ALLOW"
        rule_id = "POLICY_BASELINE_ALLOW"

    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    before_hash = _sha256(json.dumps({"intent": intent, "agent": agent_id}, sort_keys=True))
    after_hash = (
        _sha256(json.dumps({"intent": intent, "tool": tool, "params": params}, sort_keys=True))
        if decision == "ALLOW"
        else _sha256(f"UNVERIFIED:{decision}:{tool}")
    )

    receipt_core = {
        "receipt_id": f"uar_{uuid.uuid4()}",
        "timestamp": timestamp,
        "agent": {"id": agent_id, "identity_verified": identity_verified},
        "intent": intent,
        "proposed_action": {"tool": tool, "params": params},
        "policy_evaluated": {"rule_id": rule_id, "action": decision},
        "decision": decision,
        "execution_state": {"before_hash": before_hash, "after_hash": after_hash},
    }
    receipt_core["evidence_bundle_hash"] = _sha256(json.dumps(receipt_core, sort_keys=True))

    return {
        "decision": decision,
        "rule_id": rule_id,
        "risk_score": min(100, risk),
        "violations": violations,
        "receipt": receipt_core,
    }


def receipts_from_leaderboard(leaderboard: dict[str, Any]) -> list[dict[str, Any]]:
    receipts: list[dict[str, Any]] = []
    for scenario in leaderboard.get("scenarios") or []:
        tool_calls = scenario.get("tool_calls") or []
        tool = tool_calls[0].get("tool", "unknown") if tool_calls else "unknown"
        params = tool_calls[0].get("arguments", {}) if tool_calls else {}
        intent = scenario.get("scenario_name") or scenario.get("name") or "benchmark scenario"
        evaluation = evaluate_proposed_action(
            agent_id=f"bench-{scenario.get('scenario_id', 'unknown')}",
            intent=intent,
            tool=tool,
            params=params if isinstance(params, dict) else {},
        )
        if scenario.get("blocked"):
            evaluation["decision"] = "BLOCK"
            evaluation["receipt"]["decision"] = "BLOCK"
            evaluation["receipt"]["policy_evaluated"] = {
                "rule_id": "POLICY_MCP_HIJACK_BLOCK",
                "action": "BLOCK",
            }
        receipts.append(evaluation["receipt"])
    return receipts
