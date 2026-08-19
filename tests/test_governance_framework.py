"""Tests for the unified 13-module Enterprise AI Agent Governance framework."""

from __future__ import annotations

import hashlib
import hmac
import os

import pytest
from fastapi.testclient import TestClient

from nexus_governance.governance_framework import (
    AdaptiveDegradation,
    AgentIdentityService,
    AgentRegistry,
    AgentReputation,
    AgentTrustNetwork,
    DynamicTrustScorer,
    GovernanceFramework,
    ImmutableAuditTrail,
    IntentEngine,
    ToolApiGateway,
    TrajectoryEngine,
)
from nexus_governance.models import VerificationState
from nexus_governance.nexus_agent_identity import AgentProfile, RiskLevel
from nexus_shield_fast_api import app

MODULE_KEYS = GovernanceFramework.MODULE_KEYS


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def test_status_response_exposes_all_thirteen_modules(client: TestClient) -> None:
    response = client.get("/v1/governance/status")
    assert response.status_code == 200
    body = response.json()
    assert set(body["modules"].keys()) == set(MODULE_KEYS)
    for key in MODULE_KEYS:
        module = body["modules"][key]
        assert module["status"] == VerificationState.VERIFIED.value
        assert module["active"] is True


def test_api_governance_status_alias(client: TestClient) -> None:
    response = client.get("/api/governance/status")
    assert response.status_code == 200
    assert len(response.json()["modules"]) == 13


def test_agent_registry_registers_and_tracks_agents() -> None:
    profile = AgentProfile(
        agent_id="gov-test-agent",
        owner_dept="Finance",
        purpose="Testing",
        risk_level=RiskLevel.LOW,
    )
    AgentRegistry.register(profile)
    assert AgentRegistry.get("gov-test-agent") is not None
    status = AgentRegistry.module_status()
    assert status.status == VerificationState.VERIFIED


def test_agent_identity_validates_hmac_token() -> None:
    agent_id = "agent-finance-01"
    token = AgentIdentityService.issue_token(agent_id)
    identity = AgentIdentityService.verify(agent_id, token)
    assert identity.token_valid is True
    bad = AgentIdentityService.verify(agent_id, "invalid-token")
    assert bad.token_valid is False


def test_tool_api_gateway_sanitizes_sensitive_arguments() -> None:
    sanitized = ToolApiGateway.sanitize_arguments({"note": "password=secret123", "id": "1"})
    assert sanitized["note"] == "[REDACTED]"
    assert sanitized["id"] == "1"


def test_intent_engine_flags_divergent_export() -> None:
    intent = IntentEngine.evaluate("Process invoice", "export_customer_pii")
    assert intent.divergent is True
    assert intent.alignment_score < 0.5


def test_trajectory_engine_detects_unsafe_sequence() -> None:
    session = "traj-test-session"
    TrajectoryEngine.record(session, "read_invoice")
    frame = TrajectoryEngine.record(session, "export_customer_pii")
    assert frame.drift_detected is True


def test_dynamic_trust_score_degrades_on_violation() -> None:
    agent = "trust-test-agent"
    before = DynamicTrustScorer.score(agent)
    after = DynamicTrustScorer.score(agent, violation=True)
    assert after.score < before.score
    assert after.degraded is (after.score < 50)


def test_adaptive_degradation_blocks_writes_when_degraded() -> None:
    agent = "degrade-agent"
    DynamicTrustScorer.score(agent, violation=True)
    DynamicTrustScorer.score(agent, violation=True)
    trust = DynamicTrustScorer.score(agent, violation=True)
    degradation = AdaptiveDegradation.evaluate(trust, "export_customer_pii")
    assert degradation is not None
    assert degradation["blocked_action"] is True


def test_immutable_audit_trail_chains_hashes() -> None:
    first = ImmutableAuditTrail.append({"event": "test-1"})
    second = ImmutableAuditTrail.append({"event": "test-2"})
    assert second["prev_hash"] == first["entry_hash"]
    assert len(second["entry_hash"]) == 64


def test_agent_reputation_tracks_violations() -> None:
    agent = "rep-test-agent"
    AgentReputation.record(agent, "ALLOW")
    rep = AgentReputation.record(agent, "BLOCK:DLP_VIOLATION")
    assert rep["badge"] in {"TRUSTED", "WATCH", "HIGH_RISK"}
    assert rep["violations"] >= 1


def test_agent_trust_network_detects_delegation_cycles() -> None:
    AgentTrustNetwork._delegations.clear()
    AgentTrustNetwork.verify_chain("agent-b", "agent-a")
    AgentTrustNetwork.verify_chain("agent-a", "agent-b")
    result = AgentTrustNetwork.verify_chain("agent-b", "agent-a")
    assert result["verified"] is False
    assert result["reason"] == "CYCLE_DETECTED"


def test_evaluate_action_allow_path_traverses_modules(client: TestClient) -> None:
    response = client.post(
        "/v1/agent/action",
        json={
            "tool_name": "read_invoice",
            "arguments": {"invoice_id": "INV-GOV-001"},
            "user_intent": "Read invoice for finance workflow",
        },
        headers={
            "X-Nexus-Agent-Id": "agent-finance-01",
            "X-Session-Id": "gov-e2e-allow",
        },
    )
    assert response.status_code == 200
    body = response.json()
    governance = body["governance"]
    assert governance["decision"] == "ALLOW"
    assert set(governance["modules"].keys()) == set(MODULE_KEYS)
    assert governance["trust_score"] >= 0
    assert governance["authority"] is not None
    assert governance["intent"] is not None
    assert governance["trajectory"] is not None
    assert "payload_hash" in body["evidence"]


def test_evaluate_action_blocks_dlp_with_evidence(client: TestClient) -> None:
    response = client.post(
        "/v1/agent/action",
        json={"tool_name": "export_customer_pii", "arguments": {"format": "csv"}},
        headers={
            "X-Nexus-Agent-Id": "agent-finance-01",
            "X-Session-Id": "gov-e2e-block",
        },
    )
    assert response.status_code == 403
    detail = response.json()["detail"]
    assert detail["dlp_violation"] is True
    assert detail["governance"]["decision"] == "BLOCK"


def test_invalid_agent_token_marks_identity_unverified(client: TestClient) -> None:
    secret = os.getenv("NEXUS_API_KEY", "nexus_secret_key_123")
    bad_token = hmac.new(secret.encode(), b"wrong-agent", hashlib.sha256).hexdigest()[:32]
    response = client.post(
        "/v1/agent/action",
        json={"tool_name": "read_invoice", "arguments": {}},
        headers={
            "X-Nexus-Agent-Id": "agent-finance-01",
            "X-Session-Id": "gov-token-test",
            "X-Nexus-Agent-Token": bad_token,
        },
    )
    assert response.status_code == 403
    modules = response.json()["detail"]["governance"]["modules"]
    assert modules["agent_identity"]["status"] == VerificationState.UNVERIFIED.value


def test_mcp_inspect_returns_governance_modules(client: TestClient) -> None:
    response = client.post(
        "/v1/mcp/inspect",
        json={
            "mcp_payload": {
                "method": "tools/call",
                "params": {"name": "read_invoice", "arguments": {}},
            },
            "agent_trust_score": 95.0,
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert set(body["governance_modules"].keys()) == set(MODULE_KEYS)
