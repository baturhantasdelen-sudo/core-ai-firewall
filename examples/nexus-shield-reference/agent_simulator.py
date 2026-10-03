#!/usr/bin/env python3
"""Simulates valid and invalid agent actions against passport-enforced sidecar."""

from __future__ import annotations

import json
import os
import sys
import urllib.request

SIDECAR = os.environ.get("ACCOUNTABILITY_URL", "http://accountability-sidecar:8092/v1/accountability")
AGENT_ID = os.environ.get("AGENT_ID", "ap_agent_01")


def invoke(payload: dict) -> dict:
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        SIDECAR,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))


def main() -> int:
    scenarios = [
        {
            "name": "valid_read",
            "payload": {
                "agent_id": AGENT_ID,
                "intent": "Review invoice 1001",
                "tool": "read_invoice",
                "system": "mock-erp",
                "params": {"invoice_id": "1001"},
                "agent_claim": "READ",
            },
            "expect_decision": "ALLOW",
        },
        {
            "name": "blocked_over_limit",
            "payload": {
                "agent_id": AGENT_ID,
                "intent": "Pay large vendor",
                "tool": "post_payment",
                "system": "mock-erp",
                "params": {"amount": 99999, "invoice_id": "1001"},
                "agent_claim": "PAID",
            },
            "expect_http_block": True,
        },
        {
            "name": "valid_payment",
            "payload": {
                "agent_id": AGENT_ID,
                "intent": "Pay invoice 1001 within cap",
                "tool": "post_payment",
                "system": "mock-erp",
                "params": {"amount": 1200, "invoice_id": "1001"},
                "agent_claim": "PAID",
            },
            "expect_decision": "ALLOW",
            "expect_outcome": "VERIFIED",
        },
        {
            "name": "unauthorized_tool",
            "payload": {
                "agent_id": AGENT_ID,
                "intent": "Drop database",
                "tool": "drop_database",
                "system": "mock-erp",
                "params": {},
                "agent_claim": "DELETED",
            },
            "expect_http_block": True,
        },
    ]

    exit_code = 0
    for sc in scenarios:
        print(f"\n=== {sc['name']} ===")
        try:
            result = invoke(sc["payload"])
            decision = result.get("decision")
            print(json.dumps({"decision": decision, "outcome": result.get("outcome")}, indent=2))
            if sc.get("expect_http_block"):
                print("ERROR: expected passport block", file=sys.stderr)
                exit_code = 1
            elif sc.get("expect_decision") and decision != sc["expect_decision"]:
                print(f"ERROR: expected decision {sc['expect_decision']}", file=sys.stderr)
                exit_code = 1
            if sc.get("expect_outcome"):
                ov = (result.get("outcome") or {}).get("status")
                if ov != sc["expect_outcome"]:
                    print(f"ERROR: expected outcome {sc['expect_outcome']}", file=sys.stderr)
                    exit_code = 1
            uar = result.get("uar") or {}
            if uar.get("uar_version") == "2.0" and not uar.get("sha256_hash"):
                print("ERROR: missing UAR 2.0 hash", file=sys.stderr)
                exit_code = 1
        except urllib.error.HTTPError as exc:
            body = json.loads(exc.read().decode("utf-8"))
            print(json.dumps(body, indent=2))
            if sc.get("expect_http_block"):
                if body.get("decision") != "BLOCK":
                    exit_code = 1
            else:
                print(f"unexpected HTTP {exc.code}", file=sys.stderr)
                exit_code = 1
    return exit_code


if __name__ == "__main__":
    sys.exit(main())
