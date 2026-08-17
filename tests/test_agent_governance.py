"""Tests for Nexus Shield agent governance modules."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from nexus_governance.nexus_action_firewall import ActionFirewall, EnforcementDecision
from nexus_governance.nexus_agent_identity import AgentProfile, EffectiveAuthorityEngine, RiskLevel
from nexus_governance.nexus_evidence_engine import EvidenceEngine
from nexus_shield_fast_api import app


def test_effective_authority_detects_exfiltration_combo() -> None:
    profile = AgentProfile(
        agent_id="agent-1",
        owner_dept="Finance",
        purpose="Reporting",
        effective_permissions=["db:read", "api:external_post"],
    )
    result = EffectiveAuthorityEngine.analyze_authority_risk(profile)
    assert "POTENTIAL_DATA_EXFILTRATION_RISK" in result["risk_flags"]
    assert result["evaluated_risk_level"] == RiskLevel.HIGH


def test_action_firewall_blocks_high_divergence() -> None:
    decision = ActionFirewall.evaluate(
        trust_score=100.0,
        divergence_score=0.9,
        tool_name="read_file",
        action_params={},
    )
    assert decision == EnforcementDecision.BLOCK


def test_action_firewall_requires_approval_for_large_payment() -> None:
    decision = ActionFirewall.evaluate(
        trust_score=100.0,
        divergence_score=0.0,
        tool_name="create_payment",
        action_params={"amount": 5000},
    )
    assert decision == EnforcementDecision.REQUIRE_HUMAN_APPROVAL


def test_evidence_engine_generates_verified_hash() -> None:
    evidence = EvidenceEngine.generate_evidence(
        session_id="sess-1",
        agent_id="agent-1",
        tool_name="read_invoice",
        action_payload={"id": "inv-42"},
        execution_result={"status": "SUCCESS"},
    )
    assert evidence["status"] == "VERIFIED_ACTION"
    assert len(evidence["payload_hash"]) == 64


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def test_agent_action_endpoint_executes_with_evidence(client: TestClient) -> None:
    response = client.post(
        "/v1/agent/action",
        json={"tool_name": "read_invoice", "arguments": {"invoice_id": "INV-001"}},
        headers={
            "X-Nexus-Agent-Id": "agent-finance-01",
            "X-Session-Id": "sess-test-001",
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "EXECUTED"
    assert body["decision"] == "ALLOW"
    assert "payload_hash" in body["evidence"]
    assert response.headers.get("X-Nexus-Evidence-Hash") == body["evidence"]["payload_hash"]


def test_mcp_inspect_blocks_policy_violation(client: TestClient) -> None:
    response = client.post(
        "/v1/mcp/inspect",
        json={
            "mcp_payload": {
                "method": "tools/call",
                "params": {"name": "delete_records", "arguments": {}},
            },
            "agent_trust_score": 30.0,
            "divergence_score": 0.0,
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["is_allowed"] is False
    assert body["decision"] == "DEGRADE_READ_ONLY"
