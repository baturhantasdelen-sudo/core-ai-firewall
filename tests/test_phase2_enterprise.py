"""Phase 2 — Black Box, Circuit Breaker, Blast Radius."""

from __future__ import annotations

import json

import pytest

from nexus_shield.blast_radius import (
    ResourceAccess,
    compute_blast_radius,
    default_demo_resources,
    what_if_remove_tool,
)
from nexus_shield.black_box import AgentBlackBox
from nexus_shield.circuit_breaker import (
    AgentCircuitBreaker,
    CircuitAction,
    ExecutionMode,
    RiskSignals,
    action_for_risk_score,
    compute_risk_score,
)
from nexus_shield.redaction import redact_string


def test_redaction_masks_email_and_api_key() -> None:
    raw = "Contact user@corp.com with sk-abcdefghijklmnopqrstuvwxyz1234567890"
    out = redact_string(raw)
    assert "user@corp.com" not in out
    assert "sk-" not in out
    assert "[REDACTED_EMAIL]" in out
    assert "[REDACTED_SECRET]" in out


def test_black_box_redacts_on_record() -> None:
    box = AgentBlackBox(tenant_id="t1")
    rec = box.record(
        agent_id="agent-1",
        prompt="Email me at secret@example.com",
        intent="pay vendor",
        tool="post_payment",
        arguments={"api_key": "sk-abc1234567890123456789012345678901234"},
        policy_decision="ALLOW",
        api_response={"status": "PAID"},
        errors=[],
    )
    assert "secret@example.com" not in (rec.prompt or "")
    assert "sk-" not in json.dumps(rec.arguments)
    queried = box.query(agent_id="agent-1", limit=5)
    assert len(queried) == 1
    export = box.export_jsonl(agent_id="agent-1")
    assert "t1" in export
    assert "secret@example.com" not in export


def test_circuit_breaker_thresholds() -> None:
    assert action_for_risk_score(10) == CircuitAction.ALLOW
    assert action_for_risk_score(40) == CircuitAction.MONITOR
    assert action_for_risk_score(65) == CircuitAction.READ_ONLY
    assert action_for_risk_score(85) == CircuitAction.REQUIRE_APPROVAL
    assert action_for_risk_score(96) == CircuitAction.REVOKE


def test_circuit_breaker_evaluate_and_degrade() -> None:
    breaker = AgentCircuitBreaker()
    low = breaker.evaluate("a1", RiskSignals())
    assert low["circuit_action"] == CircuitAction.ALLOW.value
    assert low["can_execute_write"] is True

    high = breaker.evaluate(
        "a1",
        RiskSignals(
            intent_deviation=1.0,
            authority_deviation=1.0,
            data_sensitivity=1.0,
            destination_risk=1.0,
            action_criticality=1.0,
            trajectory_anomaly=1.0,
        ),
    )
    assert high["risk_score"] == 100.0
    assert high["circuit_action"] == CircuitAction.REVOKE.value
    state = breaker.get_state("a1")
    assert state is not None
    assert state.mode == ExecutionMode.KILLED
    assert state.can_execute_write() is False


def test_circuit_breaker_invalid_signal_range() -> None:
    with pytest.raises(ValueError):
        compute_risk_score(RiskSignals(intent_deviation=1.5))


def test_blast_radius_scoring() -> None:
    tools = ["read_invoice", "post_payment", "export_customer_database", "issue_refund"]
    report = compute_blast_radius(tools, default_demo_resources())
    assert report.level.value in ("LOW", "MEDIUM", "HIGH")
    assert report.score > 0
    assert report.write_surfaces >= 1
    assert "post_payment" in report.matrix


def test_blast_radius_what_if_removal() -> None:
    tools = ["read_invoice", "post_payment", "export_customer_database", "issue_refund"]
    resources = default_demo_resources()
    before = compute_blast_radius(tools, resources)
    analysis = what_if_remove_tool(tools, resources, "export_customer_database")
    assert analysis["score_delta"] >= 0
    assert analysis["after"]["score"] <= before.score
    assert "export_customer_database" in analysis["tool_removed"]


def test_blast_radius_what_if_unknown_tool() -> None:
    with pytest.raises(ValueError):
        what_if_remove_tool(["read_invoice"], default_demo_resources(), "missing_tool")


def test_blast_radius_custom_resource_matrix() -> None:
    resources = [
        ResourceAccess(
            resource_id="ledger",
            resource_type="db",
            sensitivity=0.8,
            permissions={"sync_ledger": "WRITE"},
        )
    ]
    report = compute_blast_radius(["sync_ledger"], resources)
    assert report.matrix["sync_ledger"]["ledger"] == "WRITE"
