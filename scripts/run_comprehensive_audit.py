#!/usr/bin/env python3
"""
Nexus Shield v2.0 — Comprehensive Accountability Audit Harness.

Executes three agent behavior profiles against live nexus_shield modules and
prints a structured verification report.

Usage (from repository root):
    python scripts/run_comprehensive_audit.py
"""

from __future__ import annotations

import json
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

# Ensure monorepo package is importable when run as a script.
_REPO_ROOT = Path(__file__).resolve().parents[1]
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))
_PKG = _REPO_ROOT / "packages" / "python"
if str(_PKG) not in sys.path:
    sys.path.insert(0, str(_PKG))

from fastapi.testclient import TestClient

from nexus_shield.accountability.app_factory import create_accountability_app
from nexus_shield.accountability.context import AccountabilityContext, set_accountability_context
from nexus_shield.core.aar import AAREngine, UniversalActionReceipt, verify_aar_integrity
from nexus_shield.core.blast_radius import BlastRadiusSimulator, ExposureEdge
from nexus_shield.core.delegation import DelegationGraph, DelegationNode
from nexus_shield.core.passport import AgentPassportRecord
from nexus_shield.core.verification import OutcomeVerificationEngine
from nexus_shield.sdk.decorators import run_secure_agent_action


class _MutableResourceDb:
    def __init__(self) -> None:
        self._states: dict[str, dict[str, Any]] = {}

    def seed(self, resource_id: str, status: str) -> None:
        self._states[resource_id] = {"status": status}

    def get_resource_state(self, resource_id: str) -> dict[str, Any]:
        return dict(self._states.get(resource_id, {"status": "PENDING"}))

    def set_resource_state(self, resource_id: str, state: dict[str, Any]) -> None:
        self._states[resource_id] = dict(state)


class _MutableLedger:
    def __init__(self, balance: float = 150_000.0) -> None:
        self._initial = balance
        self._balance = balance

    def reset(self) -> None:
        self._balance = self._initial

    def get_latest_transaction(self, resource_id: str) -> dict[str, Any]:
        return {"balance": self._balance, "resource_id": resource_id}

    def apply_payment(self, resource_id: str, amount: float) -> None:
        self._balance -= amount


@dataclass
class ProfileResult:
    profile_id: str
    title: str
    expected: str
    observed: str
    passed: bool
    duration_ms: float
    details: dict[str, Any] = field(default_factory=dict)


@dataclass
class AuditReport:
    profile_results: list[ProfileResult] = field(default_factory=list)
    module_checks_passed: int = 0
    module_checks_total: int = 0
    crypto_integrity_ok: bool = False
    total_duration_ms: float = 0.0

    @property
    def detection_rate(self) -> float:
        if not self.profile_results:
            return 0.0
        passed = sum(1 for r in self.profile_results if r.passed)
        return (passed / len(self.profile_results)) * 100.0

    @property
    def health_score(self) -> float:
        module_rate = (
            (self.module_checks_passed / self.module_checks_total) * 100.0
            if self.module_checks_total
            else 100.0
        )
        return round((self.detection_rate * 0.7) + (module_rate * 0.2) + (10.0 if self.crypto_integrity_ok else 0.0), 2)


def _supports_color() -> bool:
    if sys.platform == "win32":
        try:
            import colorama

            colorama.just_fix_windows_console()
            return True
        except ImportError:
            return False
    return sys.stdout.isatty()


class _Colors:
    def __init__(self, enabled: bool) -> None:
        self.enabled = enabled

    def wrap(self, code: str, text: str) -> str:
        if not self.enabled:
            return text
        return f"{code}{text}\033[0m"

    def green(self, text: str) -> str:
        return self.wrap("\033[92m", text)

    def red(self, text: str) -> str:
        return self.wrap("\033[91m", text)

    def yellow(self, text: str) -> str:
        return self.wrap("\033[93m", text)

    def cyan(self, text: str) -> str:
        return self.wrap("\033[96m", text)

    def bold(self, text: str) -> str:
        return self.wrap("\033[1m", text)


def _build_environment() -> tuple[AccountabilityContext, TestClient, AgentPassportRecord, AgentPassportRecord]:
    db = _MutableResourceDb()
    db.seed("invoice_1024", "PENDING")
    ledger = _MutableLedger()

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

    blast = BlastRadiusSimulator()
    blast.register_exposure(
        ExposureEdge("stripe_create_transfer", "invoice_1024", "invoice", "WRITE", 0.85)
    )

    ctx = AccountabilityContext(
        db_connector=db,
        ledger_connector=ledger,
        delegation_graph=graph,
        blast_radius_simulator=blast,
    )

    parent = AgentPassportRecord(
        passport_id="pas_live_parent01",
        identity="finance-agent-04",
        owner="Finance Department",
        allowed_scopes=["invoices:read", "payments:write"],
        financial_limit=5000.0,
        delegation_depth=1,
    )
    sub = AgentPassportRecord(
        passport_id="pas_live_subagent",
        identity="finance-agent-sub",
        owner="Finance Department",
        allowed_scopes=["payments:write"],
        financial_limit=500.0,
        delegation_depth=2,
    )
    ctx.register_passport(parent)
    ctx.register_passport(sub)
    set_accountability_context(ctx)

    client = TestClient(create_accountability_app(ctx))
    return ctx, client, parent.seal(ctx.signing_key), sub.seal(ctx.signing_key)


def _payment_headers(passport: AgentPassportRecord, **extra: str) -> dict[str, str]:
    headers = {
        "X-Nexus-Passport": passport.model_dump_json(),
        "X-Agent-Intent": "Pay invoice #1024 to vendor Acme Corp",
        "X-Nexus-Parsed-Intent": "EXECUTE_PAYMENT",
        "X-Nexus-Target-Resource": "invoice_1024",
        "X-Nexus-Required-Scopes": "payments:write",
        "X-Nexus-Amount": "4500",
        "X-Nexus-State-Before": json.dumps(
            {"invoice_status": "PENDING", "ledger_balance": 150_000.0}
        ),
    }
    headers.update(extra)
    return headers


def _run_module_sanity_checks(ctx: AccountabilityContext, report: AuditReport) -> None:
    checks: list[tuple[str, bool]] = []

    engine = OutcomeVerificationEngine(ctx.db_connector, ctx.ledger_connector)  # type: ignore[arg-type]
    ctx.db_connector.set_resource_state("invoice_1024", {"status": "PAID"})  # type: ignore[union-attr]
    ctx.ledger_connector.apply_payment("invoice_1024", 4500.0)  # type: ignore[union-attr]
    verdict, _ = engine.verify_action_outcome(
        {"parsed_intent": "EXECUTE_PAYMENT", "target_resource": "invoice_1024"},
        {"status_code": 200},
        {"invoice_status": "PENDING", "ledger_balance": 150_000.0},
    )
    checks.append(("OutcomeVerificationEngine (core)", verdict == "VERIFIED"))

    ctx.db_connector.set_resource_state("invoice_1024", {"status": "PENDING"})  # type: ignore[union-attr]
    false_verdict, false_payload = engine.verify_action_outcome(
        {"parsed_intent": "EXECUTE_PAYMENT", "target_resource": "invoice_1024"},
        {"status_code": 200},
        {"invoice_status": "PENDING", "ledger_balance": 150_000.0},
    )
    checks.append(
        (
            "OutcomeVerificationEngine false-success",
            false_verdict == "UNVERIFIED" and false_payload.get("discrepancy_detected") is True,
        )
    )

    aar_engine = AAREngine(ctx.signing_key)
    checks.append(("AAREngine signing key", aar_engine.signing_key.public_key_bytes is not None))

    escalation = ctx.delegation_graph.validate_action(  # type: ignore[union-attr]
        "finance-agent-sub",
        required_scopes=["payments:write"],
        amount=400.0,
    )
    checks.append(("DelegationGraph boundary", escalation.get("allowed") is False))

    report.module_checks_total = len(checks)
    report.module_checks_passed = sum(1 for _, ok in checks if ok)
    report.profile_results.append(
        ProfileResult(
            profile_id="MOD",
            title="Direct module imports (core + graph)",
            expected=f"{len(checks)}/{len(checks)} checks pass",
            observed=f"{report.module_checks_passed}/{report.module_checks_total} checks pass",
            passed=report.module_checks_passed == report.module_checks_total,
            duration_ms=0.0,
            details={name: ok for name, ok in checks},
        )
    )


def _reset_invoice_state(ctx: AccountabilityContext) -> None:
    ctx.db_connector.set_resource_state("invoice_1024", {"status": "PENDING"})  # type: ignore[union-attr]
    ctx.ledger_connector.reset()  # type: ignore[union-attr]


def _profile_a_compliant(ctx: AccountabilityContext, client: TestClient, passport: AgentPassportRecord) -> ProfileResult:
    t0 = time.perf_counter()
    _reset_invoice_state(ctx)

    def handler(**kwargs: Any) -> dict[str, Any]:
        target = str(kwargs["target_resource"])
        ctx.db_connector.set_resource_state(target, {"status": "PAID"})  # type: ignore[union-attr]
        ctx.ledger_connector.apply_payment(target, float(kwargs["amount"]))  # type: ignore[union-attr]
        return {"status_code": 200, "raw_body": '{"status":"succeeded"}'}

    sdk_result = run_secure_agent_action(
        passport.passport_id,
        ["payments:write"],
        handler,
        amount=4500.0,
        target_resource="invoice_1024",
        raw_prompt="Pay invoice #1024",
        state_snapshot_before={"invoice_status": "PENDING", "ledger_balance": 150_000.0},
        tool_called="stripe_create_transfer",
        request_payload={"amount": 450000, "currency": "usd"},
    )

    receipt = sdk_result.get("aar_receipt") or {}
    crypto_ok = verify_aar_integrity(UniversalActionReceipt.model_validate(receipt), ctx.signing_key)

    sdk_passed = (
        sdk_result.get("outcome_status") == "VERIFIED"
        and receipt.get("outcome_verification", {}).get("status") == "VERIFIED"
        and str(receipt.get("cryptographic_proof", {}).get("signature", "")).startswith(
            "sig_nexus_ed25519_"
        )
        and crypto_ok
    )

    _reset_invoice_state(ctx)
    http = client.post(
        "/v1/accountability/execute-payment",
        headers=_payment_headers(passport),
        json={
            "amount": 4500,
            "target_resource": "invoice_1024",
            "raw_prompt": "Pay invoice #1024",
            "apply_state_change": True,
        },
    )
    http_passed = http.status_code == 200 and http.json().get("outcome_status") == "VERIFIED"

    passed = sdk_passed and http_passed

    return ProfileResult(
        profile_id="A",
        title="Compliant Enterprise Agent",
        expected="VERIFIED AAR + valid Ed25519",
        observed=str(sdk_result.get("outcome_status")),
        passed=passed,
        duration_ms=(time.perf_counter() - t0) * 1000.0,
        details={
            "receipt_id": receipt.get("receipt_id"),
            "sdk_verified": sdk_passed,
            "gateway_verified": http_passed,
            "crypto_integrity": crypto_ok,
        },
    )


def _profile_b_false_success(ctx: AccountabilityContext, client: TestClient, passport: AgentPassportRecord) -> ProfileResult:
    t0 = time.perf_counter()
    _reset_invoice_state(ctx)

    response = client.post(
        "/v1/accountability/execute-payment",
        headers=_payment_headers(passport),
        json={
            "amount": 4500,
            "target_resource": "invoice_1024",
            "raw_prompt": "Pay invoice #1024 (hallucinated success)",
            "apply_state_change": False,
        },
    )
    body = response.json()
    incidents = ctx.store.list_incidents()
    has_incident = any(i.get("code") == "FALSE_SUCCESS" for i in incidents)

    passed = (
        response.status_code == 200
        and body.get("outcome_status") == "UNVERIFIED"
        and body.get("aar_receipt", {}).get("outcome_verification", {}).get("discrepancy_detected") is True
        and has_incident
    )

    return ProfileResult(
        profile_id="B",
        title="False-Success Rogue Agent",
        expected="UNVERIFIED + FALSE_SUCCESS incident",
        observed=str(body.get("outcome_status")),
        passed=passed,
        duration_ms=(time.perf_counter() - t0) * 1000.0,
        details={"incident_logged": has_incident, "http_status": response.status_code},
    )


def _profile_c_escalation(ctx: AccountabilityContext, client: TestClient, sub: AgentPassportRecord) -> ProfileResult:
    t0 = time.perf_counter()
    response = client.post(
        "/v1/accountability/execute-payment",
        headers=_payment_headers(sub, **{"X-Nexus-Amount": "400"}),
        json={
            "amount": 400,
            "target_resource": "invoice_1024",
            "raw_prompt": "Sub-agent privilege escalation attempt",
            "apply_state_change": True,
        },
    )
    payload = response.json()
    audit = ctx.store.list_audit_trail()
    audit_ok = any(e.get("event") == "GATEWAY_DELEGATION_DENIED" for e in audit)

    passed = (
        response.status_code == 403
        and payload.get("error") == "policy_violation"
        and audit_ok
    )

    return ProfileResult(
        profile_id="C",
        title="Privilege Escalation / Boundary Violator",
        expected="403 policy_violation + audit trail",
        observed=f"HTTP {response.status_code}",
        passed=passed,
        duration_ms=(time.perf_counter() - t0) * 1000.0,
        details={"audit_trail": audit_ok, "code": payload.get("code")},
    )


def _verify_all_receipts_crypto(ctx: AccountabilityContext) -> bool:
    from nexus_shield.core.aar import UniversalActionReceipt

    for doc in ctx.store.list_receipts():
        receipt = UniversalActionReceipt.model_validate(doc)
        if not verify_aar_integrity(receipt, ctx.signing_key):
            return False
    return True


def _print_table(report: AuditReport, colors: _Colors) -> None:
    width = 88
    print(colors.bold("=" * width))
    print(colors.bold(" NEXUS SHIELD v2.0 — COMPREHENSIVE ACCOUNTABILITY AUDIT ".center(width)))
    print(colors.bold("=" * width))
    print(
        f"{'Profile':<10} {'Scenario':<32} {'Expected':<28} {'Result':<12} {'Time':>8}"
    )
    print("-" * width)
    for row in report.profile_results:
        if row.profile_id == "MOD":
            continue
        status = colors.green("PASS") if row.passed else colors.red("FAIL")
        print(
            f"{row.profile_id:<10} {row.title[:32]:<32} {row.expected[:28]:<28} {status:<22} {row.duration_ms:>6.1f}ms"
        )
    print("-" * width)
    mod = next((r for r in report.profile_results if r.profile_id == "MOD"), None)
    if mod:
        mod_status = colors.green("PASS") if mod.passed else colors.red("FAIL")
        print(f"{'MODULES':<10} {mod.title[:32]:<32} {mod.expected[:28]:<28} {mod_status:<22}")
    print("-" * width)
    crypto = colors.green("OK") if report.crypto_integrity_ok else colors.red("FAIL")
    print(f"Cryptographic integrity (indexed AAR receipts): {crypto}")
    print(f"Total execution time: {report.total_duration_ms:.1f} ms")
    print(f"Detection rate: {report.detection_rate:.0f}%")
    health = report.health_score
    health_txt = colors.green(f"{health}%") if health >= 95 else colors.yellow(f"{health}%")
    print(f"Overall system health score: {health_txt}")
    print(colors.bold("=" * width))

    failed = [r for r in report.profile_results if not r.passed]
    if failed:
        print(colors.red("\nFailed checks:"))
        for row in failed:
            print(colors.red(f"  - [{row.profile_id}] {row.title}: {json.dumps(row.details)}"))
    else:
        print(colors.green("\nAll accountability profiles behaved as expected."))


def run_audit() -> AuditReport:
    t0 = time.perf_counter()
    report = AuditReport()

    mod_ctx, _, _, _ = _build_environment()
    _run_module_sanity_checks(mod_ctx, report)

    ctx, client, parent, sub = _build_environment()
    report.profile_results.append(_profile_a_compliant(ctx, client, parent))
    report.profile_results.append(_profile_b_false_success(ctx, client, parent))
    report.profile_results.append(_profile_c_escalation(ctx, client, sub))

    report.crypto_integrity_ok = _verify_all_receipts_crypto(ctx)
    report.total_duration_ms = (time.perf_counter() - t0) * 1000.0
    return report


def main() -> int:
    colors = _Colors(_supports_color())
    print(colors.cyan("Starting Nexus Shield v2.0 comprehensive audit...\n"))
    report = run_audit()
    _print_table(report, colors)

    profiles_only = [r for r in report.profile_results if r.profile_id != "MOD"]
    all_ok = all(r.passed for r in report.profile_results) and report.crypto_integrity_ok
    if all_ok:
        print(colors.green("\nAUDIT PASSED — agent accountability controls are functioning."))
        return 0
    print(colors.red("\nAUDIT FAILED — review failed profiles above."))
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
