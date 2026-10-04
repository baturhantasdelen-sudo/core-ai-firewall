"""Accountability core — AAR, verification, passport, delegation, blast radius."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from nexus_shield.core.aar import (
    AAREngine,
    AARSigningKeyPair,
    AgentReceiptBlock,
    AuthorityBlock,
    ExecutionBlock,
    IntentBlock,
    PolicyBlock,
    ApiResponseBlock,
    UniversalActionReceipt,
    build_outcome_verification_block,
    deterministic_demo_receipt_id,
    verify_aar_integrity,
)
from nexus_shield.core.action_control import evaluate_action_control, route_autonomy
from nexus_shield.core.circuit_breaker import AgentCircuitBreaker
from nexus_shield.core.outcome_verifier import OutcomeVerifier, resolve_consequential_action
from nexus_shield.core.blast_radius import BlastRadiusSimulator, ExposureEdge, RiskTier
from nexus_shield.core.delegation import DelegationGraph, DelegationGraphError, DelegationNode
from nexus_shield.core.passport import AgentPassportRecord, PassportError, validate_passport_action
from nexus_shield.core.verification import OutcomeVerificationEngine
from nexus_shield.core.aar import AAR_SCHEMA_ID


class FakeDb:
    def __init__(self, states: dict[str, dict]):
        self._states = states

    def get_resource_state(self, resource_id: str) -> dict:
        return dict(self._states[resource_id])


class FakeLedger:
    def __init__(self, balances: dict[str, dict]):
        self._balances = balances

    def get_latest_transaction(self, resource_id: str) -> dict:
        return dict(self._balances[resource_id])


@pytest.fixture
def signing_key() -> AARSigningKeyPair:
    return AARSigningKeyPair.generate()


@pytest.fixture
def sample_intent() -> dict:
    return {
        "raw_prompt": "Pay invoice #1024 to vendor Acme Corp for $4,500",
        "parsed_intent": "EXECUTE_PAYMENT",
        "target_resource": "invoice_1024",
    }


def test_outcome_verification_verified_flow(sample_intent: dict) -> None:
    db = FakeDb({"invoice_1024": {"status": "PAID"}})
    ledger = FakeLedger({"invoice_1024": {"balance": 145_500.0}})
    engine = OutcomeVerificationEngine(db, ledger)
    before = {"invoice_status": "PENDING", "ledger_balance": 150_000.0}

    verdict, payload = engine.verify_action_outcome(
        sample_intent,
        {"status_code": 200, "raw_body": '{"status": "succeeded"}'},
        before,
    )

    assert verdict == "VERIFIED"
    assert payload["discrepancy_detected"] is False
    assert payload["state_after"]["invoice_status"] == "PAID"
    assert payload["evidence_hash"].startswith("sha256:")


def test_outcome_verification_false_success_unverified(sample_intent: dict) -> None:
    db = FakeDb({"invoice_1024": {"status": "PENDING"}})
    ledger = FakeLedger({"invoice_1024": {"balance": 150_000.0}})
    engine = OutcomeVerificationEngine(db, ledger)
    before = {"invoice_status": "PENDING", "ledger_balance": 150_000.0}

    verdict, payload = engine.verify_action_outcome(
        sample_intent,
        {"status_code": 200, "raw_body": '{"status": "succeeded"}'},
        before,
    )

    assert verdict == "UNVERIFIED"
    assert payload["discrepancy_detected"] is True


def test_outcome_verification_non_200_failed(sample_intent: dict) -> None:
    engine = OutcomeVerificationEngine(FakeDb({}), FakeLedger({}))
    verdict, payload = engine.verify_action_outcome(
        sample_intent,
        {"status_code": 502},
        {"invoice_status": "PENDING", "ledger_balance": 0},
    )
    assert verdict == "FAILED"
    assert "non-200" in payload["reason"]


def test_passport_scope_and_financial_enforcement(signing_key: AARSigningKeyPair) -> None:
    passport = AgentPassportRecord(
        passport_id="pas_live_88192a",
        identity="finance-agent-04",
        owner="Finance Department",
        allowed_scopes=["invoices:read", "payments:write"],
        financial_limit=5000.0,
        delegation_depth=1,
    ).seal(signing_key)

    validate_passport_action(
        passport,
        required_scopes=["payments:write"],
        amount=4500.0,
        signing_key=signing_key,
    )

    with pytest.raises(PassportError, match="scope"):
        validate_passport_action(
            passport,
            required_scopes=["admin:destroy"],
            signing_key=signing_key,
        )

    with pytest.raises(PassportError, match="financial_limit"):
        validate_passport_action(
            passport,
            required_scopes=["payments:write"],
            amount=9000.0,
            signing_key=signing_key,
        )


def test_passport_tamper_rejected(signing_key: AARSigningKeyPair) -> None:
    passport = AgentPassportRecord(
        passport_id="pas_live_88192a",
        identity="finance-agent-04",
        owner="Finance Department",
        allowed_scopes=["payments:write"],
        financial_limit=5000.0,
        delegation_depth=0,
    ).seal(signing_key)

    tampered = passport.model_copy(update={"financial_limit": 999_999.0})
    with pytest.raises(PassportError, match="signature"):
        validate_passport_action(tampered, required_scopes=["payments:write"], signing_key=signing_key)


def test_delegation_graph_blocks_privilege_escalation() -> None:
    root = DelegationNode(
        agent_id="org-root",
        allowed_scopes=frozenset({"invoices:read", "payments:write"}),
        financial_limit=10_000.0,
    )
    graph = DelegationGraph(root=root)
    graph.add_delegation(
        "org-root",
        DelegationNode(
            agent_id="finance-agent-04",
            allowed_scopes=frozenset({"invoices:read", "payments:write"}),
            financial_limit=5_000.0,
        ),
    )

    with pytest.raises(DelegationGraphError, match="expands scopes"):
        graph.add_delegation(
            "finance-agent-04",
            DelegationNode(
                agent_id="rogue-agent",
                allowed_scopes=frozenset({"admin:destroy"}),
                financial_limit=100.0,
            ),
        )

    ok = graph.validate_action(
        "finance-agent-04",
        required_scopes=["payments:write"],
        amount=4500.0,
    )
    assert ok["allowed"] is True
    assert ok["verified_by_graph"] is True


def test_aar_seal_and_verify(signing_key: AARSigningKeyPair) -> None:
    engine = AAREngine(signing_key)
    receipt = engine.seal(
        agent=AgentReceiptBlock(
            identity="finance-agent-04",
            passport_id="pas_live_88192a",
            owner="Finance Department",
        ),
        intent=IntentBlock(
            raw_prompt="Pay invoice #1024",
            parsed_intent="EXECUTE_PAYMENT",
            target_resource="invoice_1024",
        ),
        authority=AuthorityBlock(
            allowed_scopes=["invoices:read", "payments:write"],
            financial_limit=5000.0,
            delegation_depth=1,
            verified_by_graph=True,
        ),
        policy=PolicyBlock(policy_id="FIN-PAY-07", evaluation="ALLOW", risk_score=0.12),
        execution=ExecutionBlock(
            tool_called="stripe_create_transfer",
            request_payload={"amount": 450_000, "currency": "usd", "destination": "ac_123456789"},
            api_response=ApiResponseBlock(status_code=200, raw_body='{"id": "tr_1OxyZ2", "status": "succeeded"}'),
        ),
        outcome_verification=build_outcome_verification_block(
            status="VERIFIED",
            verification_method="DB_STATE_AND_LEDGER_CROSS_CHECK",
            state_before={"invoice_status": "PENDING", "ledger_balance": 150_000.0},
            state_after={"invoice_status": "PAID", "ledger_balance": 145_500.0},
            discrepancy_detected=False,
            signing_key=signing_key,
        ),
        receipt_id=deterministic_demo_receipt_id("finance-payment-1024"),
        timestamp="2026-10-03T21:45:00.124Z",
    )

    assert verify_aar_integrity(receipt, signing_key)
    assert receipt.cryptographic_proof.signature.startswith("sig_nexus_ed25519_")
    doc = receipt.model_dump_document()
    assert doc["$schema"] == AAR_SCHEMA_ID
    assert doc["outcome_verification"]["state_before_hash"].startswith("sha256:")
    assert doc["outcome_verification"]["verifier_signature"].startswith("sig_nexus_ed25519_")


def test_aar_tamper_detection(signing_key: AARSigningKeyPair) -> None:
    engine = AAREngine(signing_key)
    receipt = engine.seal(
        agent=AgentReceiptBlock(
            identity="finance-agent-04",
            passport_id="pas_live_88192a",
            owner="Finance Department",
        ),
        intent=IntentBlock(
            raw_prompt="Pay invoice",
            parsed_intent="EXECUTE_PAYMENT",
            target_resource="invoice_1024",
        ),
        authority=AuthorityBlock(
            allowed_scopes=["payments:write"],
            financial_limit=5000.0,
            delegation_depth=0,
            verified_by_graph=True,
        ),
        policy=PolicyBlock(policy_id="FIN-PAY-07", evaluation="ALLOW", risk_score=0.1),
        execution=ExecutionBlock(
            tool_called="stripe_create_transfer",
            request_payload={"amount": 1},
            api_response=ApiResponseBlock(status_code=200, raw_body="{}"),
        ),
        outcome_verification=build_outcome_verification_block(
            status="VERIFIED",
            verification_method="DB_STATE_AND_LEDGER_CROSS_CHECK",
            state_before={"invoice_status": "PENDING", "ledger_balance": 1.0},
            state_after={"invoice_status": "PAID", "ledger_balance": 0.0},
            discrepancy_detected=False,
            signing_key=signing_key,
        ),
        receipt_id=deterministic_demo_receipt_id("tamper-test"),
        timestamp="2026-10-03T21:45:00.124Z",
    )

    raw = receipt.model_dump_document()
    raw["policy"]["evaluation"] = "BLOCK"
    tampered = UniversalActionReceipt.model_validate(raw)
    assert not verify_aar_integrity(tampered, signing_key)


def test_aar_schema_validation_rejects_bad_receipt_id() -> None:
    with pytest.raises(ValidationError):
        UniversalActionReceipt.model_validate(
            {
                "$schema": AAR_SCHEMA_ID,
                "receipt_id": "not-a-valid-id",
                "timestamp": "2026-10-03T21:45:00.124Z",
                "agent": {
                    "identity": "a",
                    "passport_id": "pas_live_88192a",
                    "owner": "o",
                },
                "intent": {
                    "raw_prompt": "x",
                    "parsed_intent": "EXECUTE_PAYMENT",
                    "target_resource": "r",
                },
                "authority": {
                    "allowed_scopes": ["payments:write"],
                    "financial_limit": 1.0,
                    "delegation_depth": 0,
                    "verified_by_graph": True,
                },
                "policy": {"policy_id": "P1", "evaluation": "ALLOW", "risk_score": 0.1},
                "execution": {
                    "tool_called": "t",
                    "request_payload": {},
                    "api_response": {"status_code": 200, "raw_body": "{}"},
                },
                "outcome_verification": {
                    "status": "VERIFIED",
                    "verification_method": "DB_STATE_AND_LEDGER_CROSS_CHECK",
                    "state_before": {},
                    "state_after": {},
                    "state_before_hash": "sha256:" + "c" * 64,
                    "state_after_hash": "sha256:" + "d" * 64,
                    "verifier_signature": "sig_nexus_ed25519_" + "e" * 32,
                    "discrepancy_detected": False,
                },
                "cryptographic_proof": {
                    "evidence_hash": "sha256:" + "a" * 64,
                    "signature": "sig_nexus_ed25519_" + "b" * 32,
                },
            }
        )


def test_blast_radius_simulator_scoring() -> None:
    sim = BlastRadiusSimulator()
    sim.register_exposure(
        ExposureEdge("stripe_create_transfer", "ledger_main", "ledger", "WRITE", sensitivity=0.9)
    )
    sim.register_exposure(
        ExposureEdge("stripe_create_transfer", "invoice_1024", "invoice", "WRITE", sensitivity=0.8)
    )
    sim.register_exposure(
        ExposureEdge("read_invoice", "invoice_1024", "invoice", "READ", sensitivity=0.4)
    )

    report = sim.simulate()
    assert report.tool_count == 2
    assert report.write_exposures == 2
    assert report.high_sensitivity_writes >= 1
    assert report.tier in {RiskTier.MEDIUM, RiskTier.HIGH, RiskTier.CRITICAL}

    reduced = sim.what_if_remove_tool("stripe_create_transfer")
    assert reduced.score < report.score
    assert reduced.tool_count == 1


def test_consequential_action_registry() -> None:
    assert resolve_consequential_action("EXECUTE_PAYMENT") is not None
    assert resolve_consequential_action("unknown_intent") is None


def test_autonomy_routing() -> None:
    assert route_autonomy(0.1) == "AUTO"
    assert route_autonomy(0.5) == "VERIFY"
    assert route_autonomy(0.75) == "HUMAN"
    assert route_autonomy(0.95) == "BLOCK"


def test_circuit_breaker_freezes_delegation_subtree(signing_key: AARSigningKeyPair) -> None:
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
    breaker = AgentCircuitBreaker()
    breaker.trip(
        reason="UNVERIFIED_OUTCOME",
        passport_id="pas_live_subagent",
        agent_id="finance-agent-04",
        delegation_graph=graph,
    )
    assert graph.is_frozen("finance-agent-sub")
    denied = graph.validate_action("finance-agent-sub", required_scopes=["payments:write"])
    assert denied["allowed"] is False


def test_action_control_denies_revoked_passport(signing_key: AARSigningKeyPair) -> None:
    passport = AgentPassportRecord(
        passport_id="pas_live_88192a",
        identity="finance-agent-04",
        owner="Finance Department",
        allowed_scopes=["payments:write"],
        financial_limit=5000.0,
        delegation_depth=0,
    ).seal(signing_key)
    decision = evaluate_action_control(
        passport=passport,
        intent={"parsed_intent": "EXECUTE_PAYMENT", "target_resource": "invoice_1024", "raw_prompt": "pay"},
        required_scopes=["payments:write"],
        amount=100.0,
        signing_key=signing_key,
        delegation_graph=None,
        risk_score=0.2,
        revoked_passport_ids={"pas_live_88192a"},
    )
    assert decision.allowed is False
    assert decision.autonomy_route == "BLOCK"
