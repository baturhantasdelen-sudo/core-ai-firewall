"""End-to-end accountability lifecycle — gateway, SDK, AAR sealing."""

from __future__ import annotations

import json

import pytest
from fastapi.testclient import TestClient

from nexus_shield.accountability.app_factory import create_accountability_app
from nexus_shield.accountability.context import AccountabilityContext, set_accountability_context
from nexus_shield.core.blast_radius import BlastRadiusSimulator, ExposureEdge
from nexus_shield.core.delegation import DelegationGraph, DelegationNode
from nexus_shield.core.passport import AgentPassportRecord


class MutableResourceDb:
    def __init__(self) -> None:
        self._states: dict[str, dict] = {}

    def seed(self, resource_id: str, status: str) -> None:
        self._states[resource_id] = {"status": status}

    def get_resource_state(self, resource_id: str) -> dict:
        return dict(self._states.get(resource_id, {"status": "PENDING"}))

    def set_resource_state(self, resource_id: str, state: dict) -> None:
        self._states[resource_id] = dict(state)


class MutableLedger:
    def __init__(self, balance: float = 150_000.0) -> None:
        self._balance = balance

    def get_latest_transaction(self, resource_id: str) -> dict:
        return {"balance": self._balance, "resource_id": resource_id}

    def apply_payment(self, resource_id: str, amount: float) -> None:
        self._balance -= amount


@pytest.fixture
def accountability_client() -> tuple[TestClient, AccountabilityContext, AgentPassportRecord]:
    db = MutableResourceDb()
    db.seed("invoice_1024", "PENDING")
    ledger = MutableLedger()

    root = DelegationNode(
        agent_id="human-root",
        allowed_scopes=frozenset({"invoices:read", "payments:write"}),
        financial_limit=10_000.0,
    )
    graph = DelegationGraph(root=root)
    graph.add_delegation(
        "human-root",
        DelegationNode(
            agent_id="finance-agent-04",
            allowed_scopes=frozenset({"invoices:read", "payments:write"}),
            financial_limit=5_000.0,
        ),
    )
    graph.add_delegation(
        "finance-agent-04",
        DelegationNode(
            agent_id="finance-agent-sub",
            allowed_scopes=frozenset({"invoices:read"}),
            financial_limit=1_000.0,
        ),
    )

    sim = BlastRadiusSimulator()
    sim.register_exposure(
        ExposureEdge("stripe_create_transfer", "invoice_1024", "invoice", "WRITE", 0.85)
    )
    sim.register_exposure(
        ExposureEdge("read_invoice", "invoice_1024", "invoice", "READ", 0.4)
    )

    ctx = AccountabilityContext(
        db_connector=db,
        ledger_connector=ledger,
        delegation_graph=graph,
        blast_radius_simulator=sim,
    )
    parent_passport = AgentPassportRecord(
        passport_id="pas_live_parent01",
        identity="finance-agent-04",
        owner="Finance Department",
        allowed_scopes=["invoices:read", "payments:write"],
        financial_limit=5000.0,
        delegation_depth=1,
    )
    sub_passport = AgentPassportRecord(
        passport_id="pas_live_subagent",
        identity="finance-agent-sub",
        owner="Finance Department",
        allowed_scopes=["payments:write"],
        financial_limit=500.0,
        delegation_depth=2,
    )
    ctx.register_passport(parent_passport)
    ctx.register_passport(sub_passport)
    set_accountability_context(ctx)

    client = TestClient(create_accountability_app(ctx))
    return client, ctx, parent_passport.seal(ctx.signing_key)


def _headers(passport: AgentPassportRecord, **extra: str) -> dict[str, str]:
    base = {
        "X-Nexus-Passport": passport.model_dump_json(),
        "X-Agent-Intent": "Pay invoice #1024",
        "X-Nexus-Parsed-Intent": "EXECUTE_PAYMENT",
        "X-Nexus-Target-Resource": "invoice_1024",
        "X-Nexus-Required-Scopes": "payments:write",
        "X-Nexus-Amount": "4500",
        "X-Nexus-State-Before": json.dumps(
            {"invoice_status": "PENDING", "ledger_balance": 150_000.0}
        ),
    }
    base.update(extra)
    return base


def test_full_lifecycle_verified_aar_sealed(accountability_client) -> None:
    client, ctx, passport = accountability_client
    response = client.post(
        "/v1/accountability/execute-payment",
        headers=_headers(passport),
        json={
            "amount": 4500,
            "target_resource": "invoice_1024",
            "raw_prompt": "Pay invoice #1024",
            "apply_state_change": True,
        },
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["outcome_status"] == "VERIFIED"
    assert body["aar_receipt"]["outcome_verification"]["status"] == "VERIFIED"
    assert body["aar_receipt"]["cryptographic_proof"]["signature"].startswith("sig_nexus_ed25519_")

    listed = client.get("/v1/accountability/receipts?status=VERIFIED")
    assert listed.status_code == 200
    assert len(listed.json()["receipts"]) >= 1


def test_false_success_unverified_receipt(accountability_client) -> None:
    client, ctx, passport = accountability_client
    response = client.post(
        "/v1/accountability/execute-payment",
        headers=_headers(passport),
        json={
            "amount": 4500,
            "target_resource": "invoice_1024",
            "raw_prompt": "Pay invoice #1024",
            "apply_state_change": False,
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["outcome_status"] == "UNVERIFIED"
    assert body["aar_receipt"]["outcome_verification"]["discrepancy_detected"] is True

    incidents = ctx.store.list_incidents()
    assert any(i["code"] == "FALSE_SUCCESS" for i in incidents)


def test_privilege_escalation_blocked_at_gateway(accountability_client) -> None:
    client, ctx, _parent = accountability_client
    sub = ctx.get_passport("pas_live_subagent")
    assert sub is not None

    response = client.post(
        "/v1/accountability/execute-payment",
        headers=_headers(sub, **{"X-Nexus-Amount": "400"}),
        json={
            "amount": 400,
            "target_resource": "invoice_1024",
            "raw_prompt": "Sub-agent payment attempt",
            "apply_state_change": True,
        },
    )
    assert response.status_code == 403
    report = response.json()
    assert report["error"] == "policy_violation"
    audit = ctx.store.list_audit_trail()
    assert any(
        e.get("event") in {"GATEWAY_DELEGATION_DENIED", "CIRCUIT_BREAKER_TRIP"} for e in audit
    )
