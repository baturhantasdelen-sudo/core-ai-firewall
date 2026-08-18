"""Tests for P2 Security Policy Engine & custom guardrails."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from nexus_governance.nexus_policy_engine import PolicyManager
from nexus_shield_fast_api import app

POLICY_FIXTURE = Path(__file__).resolve().parent.parent / "config" / "policies.json"


@pytest.fixture
def policy_manager() -> PolicyManager:
    manager = PolicyManager(policy_path=POLICY_FIXTURE)
    manager._rate_windows.clear()
    return manager


def test_policy_manager_loads_agent_finance_rules(policy_manager: PolicyManager) -> None:
    policy = policy_manager.get_policy("agent-finance-01")
    assert "read_invoice" in policy.allowed_tools
    assert "export_customer_pii" in policy.blocked_tools
    assert policy.rate_limit.requests_per_minute == 60


def test_policy_blocks_restricted_tool(policy_manager: PolicyManager) -> None:
    result = policy_manager.evaluate_tool("agent-finance-01", "sess-1", "delete_database")
    assert result.allowed is False
    assert result.decision == "BLOCK"
    assert result.reason == "POLICY_VIOLATION"


def test_policy_blocks_dlp_export_customer_pii(policy_manager: PolicyManager) -> None:
    result = policy_manager.evaluate_tool("agent-finance-01", "sess-1", "export_customer_pii")
    assert result.allowed is False
    assert result.dlp_violation is True
    assert result.reason == "DLP_VIOLATION"


def test_policy_blocks_tool_outside_allowlist(policy_manager: PolicyManager) -> None:
    result = policy_manager.evaluate_tool("agent-finance-01", "sess-1", "create_payment")
    assert result.allowed is False
    assert result.decision == "BLOCK"


def test_policy_allows_read_invoice(policy_manager: PolicyManager) -> None:
    result = policy_manager.evaluate_tool("agent-finance-01", "sess-1", "read_invoice")
    assert result.allowed is True
    assert result.decision == "ALLOW"


def test_policy_rate_limit_enforced(policy_manager: PolicyManager) -> None:
    policy = policy_manager.get_policy("agent-finance-01")
    policy_manager._agents["agent-finance-01"] = policy.__class__(
        agent_id=policy.agent_id,
        allowed_tools=policy.allowed_tools,
        blocked_tools=policy.blocked_tools,
        rate_limit=policy.rate_limit.__class__(requests_per_minute=3, scope=policy.rate_limit.scope),
        dlp=policy.dlp,
    )
    for _ in range(3):
        assert policy_manager.evaluate_tool("agent-finance-01", "sess-rate", "read_invoice").allowed
    blocked = policy_manager.evaluate_tool("agent-finance-01", "sess-rate", "read_invoice")
    assert blocked.allowed is False
    assert blocked.rate_limit_violation is True


def test_block_evidence_contains_decision_fields(policy_manager: PolicyManager) -> None:
    evidence = policy_manager.build_block_evidence(
        agent_id="agent-finance-01",
        session_id="sess-1",
        tool_name="export_customer_pii",
        decision="BLOCK",
        reason="DLP_VIOLATION",
        action_payload={"batch": "all"},
    )
    assert evidence["decision"] == "BLOCK"
    assert evidence["agent_id"] == "agent-finance-01"
    assert evidence["session_id"] == "sess-1"
    assert len(evidence["payload_hash"]) == 64


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def test_agent_action_endpoint_blocks_dlp_tool(client: TestClient) -> None:
    response = client.post(
        "/v1/agent/action",
        json={"tool_name": "export_customer_pii", "arguments": {"format": "csv"}},
        headers={
            "X-Nexus-Agent-Id": "agent-finance-01",
            "X-Session-Id": "sess-dlp-test",
        },
    )
    assert response.status_code == 403
    body = response.json()
    detail = body["detail"]
    assert detail["decision"] == "BLOCK"
    assert detail["dlp_violation"] is True
    assert detail["evidence"]["decision"] == "BLOCK"
    assert detail["evidence"]["session_id"] == "sess-dlp-test"


def test_agent_action_endpoint_allows_read_invoice(client: TestClient) -> None:
    response = client.post(
        "/v1/agent/action",
        json={"tool_name": "read_invoice", "arguments": {"invoice_id": "INV-100"}},
        headers={
            "X-Nexus-Agent-Id": "agent-finance-01",
            "X-Session-Id": "sess-allow-test",
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "EXECUTED"
    assert body["policy"]["decision"] == "ALLOW"


def test_policies_json_is_valid() -> None:
    data = json.loads(POLICY_FIXTURE.read_text(encoding="utf-8"))
    agents = data.get("policies") or data.get("agents", {})
    assert "agent-finance-01" in agents
