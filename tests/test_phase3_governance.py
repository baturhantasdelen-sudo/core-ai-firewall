"""Phase 3 — Delegation, UAR protocol, supply chain."""

from __future__ import annotations

import json

import pytest

from nexus_shield.delegation import DelegationChain, DelegationError, DelegationHop, RootAuthority
from nexus_shield.protocol import (
    export_protocol_spec_json,
    export_uar_v2_json_schema,
    validate_uar_protocol_document,
)
from nexus_shield.supply_chain import RiskSeverity, scan_agent_supply_chain
from nexus_shield.uar_verify import build_uar_v2_receipt


def _sample_chain() -> DelegationChain:
    root = RootAuthority(
        authority_id="root-org",
        allowed_tools=frozenset({"read_invoice", "post_payment", "issue_refund"}),
        allowed_systems=frozenset({"mock-erp", "payment_api"}),
        max_financial_authority=10_000.0,
    )
    chain = DelegationChain(root=root)
    chain.add_hop(
        DelegationHop(
            from_agent="root-org",
            to_agent="agent-a",
            allowed_tools=frozenset({"read_invoice", "post_payment"}),
            allowed_systems=frozenset({"mock-erp"}),
            max_financial_authority=5_000.0,
        )
    )
    chain.add_hop(
        DelegationHop(
            from_agent="agent-a",
            to_agent="agent-b",
            allowed_tools=frozenset({"read_invoice"}),
            allowed_systems=frozenset({"mock-erp"}),
            max_financial_authority=1_000.0,
        )
    )
    return chain


def test_delegation_allows_in_scope_action() -> None:
    chain = _sample_chain()
    result = chain.validate_action(
        "agent-b",
        {"tool": "read_invoice", "system": "mock-erp", "params": {}},
    )
    assert result["allowed"] is True
    assert result["chain"] == ["root-org", "agent-a", "agent-b"]


def test_delegation_blocks_tool_not_delegated() -> None:
    chain = _sample_chain()
    result = chain.validate_action(
        "agent-b",
        {"tool": "post_payment", "system": "mock-erp", "params": {"amount": 100}},
    )
    assert result["allowed"] is False


def test_delegation_blocks_financial_overflow() -> None:
    chain = _sample_chain()
    result = chain.validate_action(
        "agent-a",
        {"tool": "post_payment", "system": "mock-erp", "params": {"amount": 9_999}},
    )
    assert result["allowed"] is False


def test_delegation_rejects_scope_expansion_on_hop() -> None:
    root = RootAuthority(
        authority_id="root",
        allowed_tools=frozenset({"read_invoice"}),
        allowed_systems=frozenset({"erp"}),
        max_financial_authority=100.0,
    )
    chain = DelegationChain(root=root)
    with pytest.raises(DelegationError):
        chain.add_hop(
            DelegationHop(
                from_agent="root",
                to_agent="agent-x",
                allowed_tools=frozenset({"read_invoice", "drop_database"}),
                allowed_systems=frozenset({"erp"}),
                max_financial_authority=50.0,
            )
        )


def test_uar_protocol_schema_export() -> None:
    schema = export_uar_v2_json_schema()
    assert schema["$id"].endswith("/2.0")
    assert "agent_passport" in schema["properties"]
    spec = json.loads(export_protocol_spec_json())
    assert spec["version"] == "2.0"
    assert "json_schema" in spec


def test_uar_protocol_validates_built_receipt() -> None:
    receipt = build_uar_v2_receipt(
        agent_passport={"agent_id": "a1"},
        intent="test",
        action={"tool": "read_invoice"},
        state_before={},
        state_after={},
        outcome_verification={"status": "VERIFIED"},
        decision="ALLOW",
        receipt_id="uar2_protocol_test",
        timestamp="2026-10-03T14:00:00Z",
    )
    result = validate_uar_protocol_document(receipt)
    assert result["valid"] is True, result["errors"]


def test_uar_protocol_rejects_invalid_outcome_status() -> None:
    receipt = build_uar_v2_receipt(
        agent_passport={"agent_id": "a1"},
        intent="test",
        action={"tool": "t"},
        state_before={},
        state_after={},
        outcome_verification={"status": "VERIFIED"},
        decision="ALLOW",
        receipt_id="uar2_bad_ov",
        timestamp="2026-10-03T14:00:01Z",
    )
    receipt["outcome_verification"] = {"status": "MAYBE"}
    result = validate_uar_protocol_document(receipt)
    assert result["valid"] is False


def test_supply_chain_flags_unsigned_mcp() -> None:
    report = scan_agent_supply_chain(
        {
            "agent_id": "agent-1",
            "allowed_tools": ["read_invoice"],
            "mcp_servers": [
                {"name": " rogue-mcp ", "vendor": "community", "signed": False, "permissions": ["shell_exec"]},
            ],
        }
    )
    codes = {f.code for f in report.findings}
    assert "UNSIGNED_MCP_SERVER" in codes
    assert report.max_severity in (RiskSeverity.HIGH, RiskSeverity.CRITICAL)


def test_supply_chain_mcp_permission_overflow() -> None:
    report = scan_agent_supply_chain(
        {
            "agent_id": "agent-2",
            "allowed_tools": ["read_invoice"],
            "mcp_servers": [
                {
                    "name": "payments-mcp",
                    "vendor": "acme",
                    "signed": True,
                    "permissions": ["admin", "shell_exec"],
                }
            ],
        }
    )
    assert any(f.code == "MCP_INHERITED_PERMISSION_OVERFLOW" for f in report.findings)
