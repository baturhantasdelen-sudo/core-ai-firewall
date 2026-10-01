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


def _resolve_policy_sets(
    policy_config: dict[str, Any] | None,
) -> tuple[frozenset[str], frozenset[str], frozenset[str], frozenset[str], int]:
    high_risk = set(HIGH_RISK_TOOLS)
    blocked: set[str] = set()
    allowed: set[str] = set()
    require_approval: set[str] = set()
    block_threshold = 85
    if policy_config:
        high_risk.update(policy_config.get("high_risk_tools") or [])
        blocked.update(policy_config.get("blocked_tools") or [])
        allowed.update(policy_config.get("allowed_tools") or [])
        require_approval.update(policy_config.get("require_approval_tools") or [])
        if policy_config.get("block_risk_threshold") is not None:
            block_threshold = int(policy_config["block_risk_threshold"])
    return (
        frozenset(high_risk),
        frozenset(blocked),
        frozenset(allowed),
        frozenset(require_approval),
        block_threshold,
    )


def evaluate_proposed_action(
    *,
    agent_id: str,
    intent: str,
    tool: str,
    params: dict[str, Any] | None = None,
    identity_verified: bool = True,
    receipt_id: str | None = None,
    timestamp_utc: str | None = None,
    policy_config: dict[str, Any] | None = None,
) -> dict[str, Any]:
    params = params or {}
    blob = f"{tool} {json.dumps(params, sort_keys=True)}".lower()
    risk = 0
    violations: list[str] = []

    high_risk, blocked, allowed, require_approval, block_threshold = _resolve_policy_sets(
        policy_config
    )

    if tool in blocked:
        return _finalize_evaluation(
            agent_id=agent_id,
            intent=intent,
            tool=tool,
            params=params,
            identity_verified=identity_verified,
            receipt_id=receipt_id,
            timestamp_utc=timestamp_utc,
            decision="BLOCK",
            rule_id="POLICY_BLOCKED_TOOL",
            risk_score=100,
            violations=[f"BLOCKED_TOOL:{tool}"],
        )

    if tool in require_approval:
        return _finalize_evaluation(
            agent_id=agent_id,
            intent=intent,
            tool=tool,
            params=params,
            identity_verified=identity_verified,
            receipt_id=receipt_id,
            timestamp_utc=timestamp_utc,
            decision="REQUIRE_APPROVAL",
            rule_id="POLICY_REQUIRE_APPROVAL",
            risk_score=70,
            violations=[f"REQUIRE_APPROVAL:{tool}"],
        )

    if tool in allowed and not any(p in blob for p in EXFIL_PATTERN):
        return _finalize_evaluation(
            agent_id=agent_id,
            intent=intent,
            tool=tool,
            params=params,
            identity_verified=identity_verified,
            receipt_id=receipt_id,
            timestamp_utc=timestamp_utc,
            decision="ALLOW",
            rule_id="POLICY_ALLOWLIST",
            risk_score=0,
            violations=[],
        )

    if tool in high_risk:
        risk += 35
        violations.append(f"HIGH_RISK_TOOL:{tool}")
    if any(p in blob for p in EXFIL_PATTERN):
        risk += 40
        violations.append("EXFIL_PATTERN")
    if "invoice" in intent.lower() and "export" in tool.lower():
        risk += 45
        violations.append("INTENT_ACTION_DIVERGENCE")

    if risk >= block_threshold:
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

    return _finalize_evaluation(
        agent_id=agent_id,
        intent=intent,
        tool=tool,
        params=params,
        identity_verified=identity_verified,
        receipt_id=receipt_id,
        timestamp_utc=timestamp_utc,
        decision=decision,
        rule_id=rule_id,
        risk_score=min(100, risk),
        violations=violations,
    )


def _finalize_evaluation(
    *,
    agent_id: str,
    intent: str,
    tool: str,
    params: dict[str, Any],
    identity_verified: bool,
    receipt_id: str | None,
    timestamp_utc: str | None,
    decision: AdaptiveDecision,
    rule_id: str,
    risk_score: int,
    violations: list[str],
) -> dict[str, Any]:

    timestamp = timestamp_utc or datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    before_hash = _sha256(json.dumps({"intent": intent, "agent": agent_id}, sort_keys=True))
    after_hash = (
        _sha256(json.dumps({"intent": intent, "tool": tool, "params": params}, sort_keys=True))
        if decision == "ALLOW"
        else _sha256(f"UNVERIFIED:{decision}:{tool}")
    )

    receipt_core = {
        "receipt_id": receipt_id or f"uar_{uuid.uuid4()}",
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
        "risk_score": risk_score,
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
