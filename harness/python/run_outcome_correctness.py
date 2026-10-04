#!/usr/bin/env python3
"""End-to-end outcome correctness — expected business state vs API response."""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

_REPO = Path(__file__).resolve().parents[2]
_PKG = _REPO / "packages" / "python"
for path in (_REPO, _PKG):
    if str(path) not in sys.path:
        sys.path.insert(0, str(path))

from nexus_shield.core.outcome_verifier import OutcomeVerifier


class _MemoryDb:
    def __init__(self, status: str) -> None:
        self._status = status

    def get_resource_state(self, resource_id: str) -> dict:
        return {"status": self._status, "resource_id": resource_id}


class _MemoryLedger:
    def __init__(self, balance: float) -> None:
        self._balance = balance

    def get_latest_transaction(self, resource_id: str) -> dict:
        return {"balance": self._balance, "resource_id": resource_id}


def run_outcome_correctness_checks() -> dict:
    intent = {
        "parsed_intent": "EXECUTE_PAYMENT",
        "target_resource": "invoice_1024",
        "raw_prompt": "Pay invoice",
    }
    execution_ok = {"status_code": 200, "raw_body": '{"status":"succeeded"}', "external_transaction_id": "tr_harness_01"}
    before = {"invoice_status": "PENDING", "ledger_balance": 150_000.0}

    verifier = OutcomeVerifier(_MemoryDb("PAID"), _MemoryLedger(145_500.0))
    verified, verified_payload = verifier.verify_action_outcome(intent, execution_ok, before)

    false_success_verifier = OutcomeVerifier(_MemoryDb("PENDING"), _MemoryLedger(150_000.0))
    unverified, unverified_payload = false_success_verifier.verify_action_outcome(intent, execution_ok, before)

    return {
        "scenario": "expected_action_vs_actual_business_state",
        "verified_case": {
            "verdict": verified,
            "discrepancy_detected": verified_payload.get("discrepancy_detected"),
            "state_after_hash": verified_payload.get("state_after_hash"),
        },
        "false_success_case": {
            "verdict": unverified,
            "discrepancy_detected": unverified_payload.get("discrepancy_detected"),
        },
        "pass": verified == "VERIFIED" and unverified == "UNVERIFIED",
        "proxy_base_url": os.environ.get("HARNESS_BASE_URL", "http://127.0.0.1:8080/v1"),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Nexus harness — outcome correctness")
    parser.add_argument("--json-out", default="")
    args = parser.parse_args()
    result = run_outcome_correctness_checks()
    print(json.dumps(result, indent=2))
    if args.json_out:
        out = Path(args.json_out)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(result, indent=2), encoding="utf-8")
    return 0 if result["pass"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
