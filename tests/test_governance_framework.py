"""Tests for the unified 13-module Enterprise AI Agent Governance framework."""

from __future__ import annotations

import asyncio
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
from nexus_governance.redis_store import GovernanceRedisStore
from nexus_shield_fast_api import app

MODULE_KEYS = GovernanceFramework.MODULE_KEYS


@pytest.fixture(autouse=True)
def reset_governance_memory() -> None:
    GovernanceRedisStore.reset_memory_state()
    yield
    GovernanceRedisStore.reset_memory_state()


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


def test_intent_engine_flags_weather_invoice_mismatch() -> None:
    intent = IntentEngine.evaluate("What's the weather in Istanbul today?", "read_invoice")
    assert intent.intent_mismatch is True
    assert "INTENT_MISMATCH" in intent.risk_flags


def test_trajectory_engine_detects_unsafe_sequence() -> None:
    session = "traj-test-session"

    async def run() -> None:
        await TrajectoryEngine.record(session, "agent-1", "read_invoice")
        frame = await TrajectoryEngine.record(session, "agent-1", "export_customer_pii")
        assert frame.drift_detected is True
        assert len(frame.trajectory) == 2

    asyncio.run(run())


def test_trajectory_exfiltration_sequence_elevates_critical() -> None:
    session = "traj-exfil-session"

    async def run() -> None:
        await TrajectoryEngine.record(session, "agent-finance-01", "read_invoice")
        frame = await TrajectoryEngine.record(session, "agent-finance-01", "get_account_balance")
        assert frame.evaluated_risk_level == "CRITICAL"
        assert "POTENTIAL_DATA_EXFILTRATION_RISK" in frame.risk_flags
        assert "TRAJECTORY_VIOLATION" in frame.risk_flags
        assert frame.requires_human_approval is True

    asyncio.run(run())


def test_trajectory_three_step_email_sequence() -> None:
    session = "traj-email-session"

    async def run() -> None:
        await TrajectoryEngine.record(session, "agent-1", "read_invoice")
        await TrajectoryEngine.record(session, "agent-1", "list_emails")
        frame = await TrajectoryEngine.record(session, "agent-1", "send_email")
        assert frame.evaluated_risk_level == "CRITICAL"
        assert frame.requires_human_approval is True

    asyncio.run(run())


def test_trajectory_transfer_funds_after_read_invoice() -> None:
    session = "traj-transfer-session"

    async def run() -> None:
        await TrajectoryEngine.record(session, "agent-finance-01", "read_invoice")
        await TrajectoryEngine.record(session, "agent-finance-01", "fetch_metadata")
        frame = await TrajectoryEngine.record(session, "agent-finance-01", "transfer_funds")
        assert frame.evaluated_risk_level == "CRITICAL"
        assert frame.requires_human_approval is True
        assert "POTENTIAL_DATA_EXFILTRATION_RISK" in frame.risk_flags
        assert "TRAJECTORY_VIOLATION" in frame.risk_flags

    asyncio.run(run())


def test_trajectory_pending_approval_on_exfil_sequence(client: TestClient) -> None:
    session = "traj-pending-session"
    first = client.post(
        "/v1/agent/action",
        json={"tool_name": "read_invoice", "arguments": {"invoice_id": "INV-1"}},
        headers={"X-Nexus-Agent-Id": "agent-finance-01", "X-Session-Id": session},
    )
    assert first.status_code == 200

    second = client.post(
        "/v1/agent/action",
        json={"tool_name": "get_account_balance", "arguments": {"account_id": "ACC-1"}},
        headers={"X-Nexus-Agent-Id": "agent-finance-01", "X-Session-Id": session},
    )
    assert second.status_code == 200
    body = second.json()
    assert body["status"] == "PENDING_APPROVAL"
    assert body["decision"] == "REQUIRES_HUMAN_APPROVAL"
    assert body["requires_human_approval"] is True
    assert body["approval_id"].startswith("appr_")
    assert body["policy"]["decision"] == "REQUIRES_HUMAN_APPROVAL"
    assert "POTENTIAL_DATA_EXFILTRATION_RISK" in body["authority_analysis"]["risk_flags"]
    assert "TRAJECTORY_VIOLATION" in body["authority_analysis"]["risk_flags"]
    assert body["authority_analysis"]["evaluated_risk_level"] == "CRITICAL"
    assert body["result"]["status"] == "WAITING_FOR_APPROVAL"
    assert len(body["trajectory"]) == 2
    assert "payload_hash" in body["evidence"]

    audit = client.get("/v1/governance/audit-trail?limit=5")
    assert audit.status_code == 200
    pending_entry = next(
        entry for entry in audit.json()["entries"] if entry.get("tool_name") == "get_account_balance"
    )
    assert pending_entry["decision"] == "PENDING_APPROVAL"
    assert pending_entry["evaluated_risk_level"] == "CRITICAL"
    assert "POTENTIAL_DATA_EXFILTRATION_RISK" in pending_entry["risk_flags"]
    assert pending_entry["approval_id"].startswith("appr_")


def test_trajectory_case_insensitive_tools_and_session_header(client: TestClient) -> None:
    session = "case-insensitive-session"
    first = client.post(
        "/v1/agent/action",
        json={"tool_name": "READ_INVOICE", "arguments": {"invoice_id": "INV-1"}},
        headers={"X-Nexus-Agent-Id": "agent-finance-01", "x-session-id": session},
    )
    assert first.status_code == 200

    second = client.post(
        "/v1/agent/action",
        json={"tool_name": "Get_Account_Balance", "arguments": {"account_id": "ACC-1"}},
        headers={"X-Nexus-Agent-Id": "agent-finance-01", "x-session-id": session},
    )
    assert second.status_code == 200
    body = second.json()
    assert body["status"] == "PENDING_APPROVAL"
    assert body["decision"] == "REQUIRES_HUMAN_APPROVAL"
    assert "TRAJECTORY_VIOLATION" in body["authority_analysis"]["risk_flags"]


def test_intent_mismatch_triggers_pending_approval(client: TestClient) -> None:
    AgentRegistry.register(
        AgentProfile(
            agent_id="agent-intent-test",
            owner_dept="Finance",
            purpose="Intent testing",
            effective_permissions=["db:read"],
        )
    )
    response = client.post(
        "/v1/agent/action",
        json={
            "tool_name": "read_invoice",
            "arguments": {"invoice_id": "INV-1"},
            "user_prompt": "What's the weather in Ankara?",
            "tool_purpose": "Finansal fatura detaylarını veri tabanından sorgular.",
        },
        headers={"X-Nexus-Agent-Id": "agent-intent-test", "X-Session-Id": "intent-mismatch-session"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "PENDING_APPROVAL"
    assert body["decision"] == "REQUIRES_HUMAN_APPROVAL"
    assert "INTENT_MISMATCH" in body["governance"]["intent"]["risk_flags"]
    assert "INTENT_MISMATCH" in body["authority_analysis"]["risk_flags"]
    assert body["intent_analysis"]["intent_matched"] is False
    assert body["intent_analysis"]["flag"] == "INTENT_MISMATCH"
    assert "semantic intent mismatch" in body["result"]["message"].lower()


def test_audit_trail_endpoint_returns_entries(client: TestClient) -> None:
    client.post(
        "/v1/agent/action",
        json={"tool_name": "read_invoice", "arguments": {"invoice_id": "INV-AUDIT"}},
        headers={"X-Nexus-Agent-Id": "agent-finance-01", "X-Session-Id": "audit-trail-session"},
    )
    response = client.get("/v1/governance/audit-trail?limit=5")
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "*"
    body = response.json()
    assert "entries" in body
    assert len(body["entries"]) >= 1
    entry = body["entries"][0]
    assert entry["tool_name"] == "read_invoice"
    assert entry["payload_hash"]
    assert entry["policy"] is not None


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
    async def run() -> None:
        first = await ImmutableAuditTrail.append({"event": "test-1"})
        second = await ImmutableAuditTrail.append({"event": "test-2"})
        assert second["prev_hash"] == first["entry_hash"]
        assert len(second["entry_hash"]) == 64

    asyncio.run(run())


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


def test_enforcement_override_payload_shape(client: TestClient) -> None:
    response = client.post(
        "/v1/agent/action",
        json={"tool_name": "read_invoice", "arguments": {"invoice_id": "INV-ENF"}},
        headers={
            "X-Nexus-Agent-Id": "agent-finance-01",
            "X-Session-Id": "enforcement-override-session",
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "PENDING_APPROVAL"
    assert body["decision"] == "REQUIRES_HUMAN_APPROVAL"
    assert body["requires_human_approval"] is True
    assert body["approval_id"].startswith("appr_")
    assert body["authority_analysis"]["evaluated_risk_level"] in {"HIGH", "CRITICAL"}
    assert "POTENTIAL_DATA_EXFILTRATION_RISK" in body["authority_analysis"]["risk_flags"]
    assert body["policy"]["agent_id"] == "agent-finance-01"
    assert body["policy"]["tool_name"] == "read_invoice"
    assert body["policy"]["decision"] == "REQUIRES_HUMAN_APPROVAL"
    assert body["result"]["status"] == "WAITING_FOR_APPROVAL"


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
    assert body["decision"] == "REQUIRES_HUMAN_APPROVAL"
    assert body["status"] == "PENDING_APPROVAL"
    assert body["requires_human_approval"] is True
    assert body["result"]["status"] == "WAITING_FOR_APPROVAL"
    assert body["authority_analysis"]["evaluated_risk_level"] in {"HIGH", "CRITICAL"}
    assert "POTENTIAL_DATA_EXFILTRATION_RISK" in body["authority_analysis"]["risk_flags"]


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


def test_hitl_approval_decision_rejects_pending_request(client: TestClient) -> None:
    pending = client.post(
        "/v1/agent/action",
        json={
            "tool_name": "read_invoice",
            "arguments": {"invoice_id": "INV-HITL-REJECT"},
            "user_prompt": "What's the weather in Istanbul?",
        },
        headers={
            "X-Nexus-Agent-Id": "agent-finance-01",
            "X-Session-Id": "hitl-decision-session",
        },
    )
    assert pending.status_code == 200
    pending_body = pending.json()
    approval_id = pending_body["approval_id"]
    assert pending_body["status"] == "PENDING_APPROVAL"

    decision = client.post(
        "/v1/agent/approval/decision",
        json={
            "approval_id": approval_id,
            "decision": "REJECTED",
            "reviewer_notes": "Rejected by integration test reviewer.",
        },
        headers={"X-Nexus-Agent-Id": "agent-finance-01"},
    )
    assert decision.status_code == 200
    body = decision.json()
    assert body["status"] == "REJECTED"
    assert body["decision"] == "REJECTED"
    assert body["approval_id"] == approval_id
    assert body["agent_id"] == "agent-finance-01"


def test_hitl_approval_decision_returns_404_for_unknown_id(client: TestClient) -> None:
    response = client.post(
        "/v1/agent/approval/decision",
        json={
            "approval_id": "appr_deadbeef",
            "decision": "REJECTED",
            "reviewer_notes": "missing record",
        },
        headers={"X-Nexus-Agent-Id": "agent-finance-01"},
    )
    assert response.status_code == 404


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
