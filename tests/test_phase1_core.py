"""Phase 1 — Agent Passport, outcome verification, UAR 2.0."""

from __future__ import annotations

import copy
import json
import sys
from pathlib import Path

import pytest

from nexus_shield.outcome_verifier import verify_outcome
from nexus_shield.passport import AgentPassport, PassportValidationError, validate_passport
from nexus_shield.uar_verify import build_uar_v2_receipt, compute_uar_v2_hash, verify_receipt_dict

ROOT = Path(__file__).resolve().parents[1]
SAMPLE_V1 = ROOT / "examples" / "sample-receipt.json"


def _sample_passport() -> AgentPassport:
    return AgentPassport(
        agent_id="ap_agent_01",
        owner="owner@example.com",
        organization="Acme",
        purpose="AP automation",
        allowed_systems=["mock-erp"],
        allowed_tools=["read_invoice", "post_payment"],
        max_financial_authority=5000.0,
        time_validity={"start_hour": 0, "end_hour": 23},
        risk_level="medium",
    )


def test_passport_allows_read_invoice() -> None:
    p = _sample_passport()
    assert validate_passport(
        p,
        {"tool": "read_invoice", "system": "mock-erp", "params": {"invoice_id": "1"}},
    )


def test_passport_rejects_unauthorized_tool() -> None:
    p = _sample_passport()
    assert not validate_passport(p, {"tool": "drop_database", "system": "mock-erp", "params": {}})


def test_passport_rejects_over_financial_limit() -> None:
    p = _sample_passport()
    assert not validate_passport(
        p,
        {"tool": "post_payment", "system": "mock-erp", "params": {"amount": 99999}},
    )


def test_passport_from_dict_requires_fields() -> None:
    with pytest.raises(PassportValidationError):
        AgentPassport.from_dict({"agent_id": "x"})


def test_outcome_verified_on_matching_paid() -> None:
    result = verify_outcome(
        "PAID",
        {"status_code": 200, "status": "PAID"},
        {"payments": {"p1": {"status": "PAID"}}, "payment_status": "PAID"},
        state_before={"payments": {}},
    )
    assert result["status"] == "VERIFIED"


def test_outcome_discrepancy_on_mismatch() -> None:
    result = verify_outcome(
        "PAID",
        {"status_code": 200, "status": "FAILED"},
        {"payment_status": "FAILED"},
        state_before={},
    )
    assert result["status"] == "DISCREPANCY"


def test_outcome_unverified_when_no_actual() -> None:
    result = verify_outcome("PAID", {}, {}, state_before={})
    assert result["status"] == "UNVERIFIED"


def test_uar_v2_build_and_verify() -> None:
    receipt = build_uar_v2_receipt(
        agent_passport={"agent_id": "ap_agent_01", "owner": "o", "organization": "Acme", "purpose": "p", "risk_level": "low", "max_financial_authority": 5000},
        intent="Pay vendor",
        action={"tool": "post_payment", "params": {"amount": 100}},
        state_before={"invoices": {"1001": {"status": "OPEN"}}},
        state_after={"invoices": {"1001": {"status": "PAID"}}},
        outcome_verification={"status": "VERIFIED", "reason": "ok"},
        decision="ALLOW",
        receipt_id="uar2_test_fixed",
        timestamp="2026-10-03T12:00:00Z",
    )
    check = verify_receipt_dict(receipt)
    assert check["valid"] is True
    assert check["format"] == "uar_v2"
    assert receipt["sha256_hash"] == compute_uar_v2_hash(receipt)


def test_uar_v2_tamper_fails() -> None:
    receipt = build_uar_v2_receipt(
        agent_passport={"agent_id": "a"},
        intent="x",
        action={"tool": "t"},
        state_before={},
        state_after={},
        outcome_verification={"status": "VERIFIED"},
        decision="ALLOW",
        receipt_id="uar2_tamper",
        timestamp="2026-10-03T12:00:01Z",
    )
    bad = copy.deepcopy(receipt)
    bad["decision"] = "BLOCK"
    assert verify_receipt_dict(bad)["valid"] is False


def test_uar_v1_sample_still_valid() -> None:
    if SAMPLE_V1.is_file():
        data = json.loads(SAMPLE_V1.read_text(encoding="utf-8"))
        assert verify_receipt_dict(data)["valid"] is True


def test_cli_verify_uar_v2(tmp_path: Path) -> None:
    receipt = build_uar_v2_receipt(
        agent_passport={"agent_id": "cli"},
        intent="i",
        action={"tool": "read_invoice"},
        state_before={"a": 1},
        state_after={"a": 2},
        outcome_verification={"status": "VERIFIED"},
        decision="ALLOW",
        receipt_id="uar2_cli",
        timestamp="2026-10-03T12:00:02Z",
    )
    path = tmp_path / "r.json"
    path.write_text(json.dumps(receipt), encoding="utf-8")
    import subprocess

    proc = subprocess.run(
        [sys.executable, "-m", "nexus_shield", "uar", "verify", str(path)],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    assert proc.returncode == 0, proc.stderr
    assert "[VERIFIED]" in proc.stdout
