#!/usr/bin/env python3
"""
Sample agent — unchanged integration pattern; only MCP_SERVER_URL points at the gateway.

Simulates read_invoice (ALLOW) and post_payment (BLOCK) tool calls.
"""

from __future__ import annotations

import json
import os
import sys
import urllib.request

MCP_URL = os.environ.get("MCP_SERVER_URL", "http://mcp-gateway:8200")


def mcp_call(method: str, params: dict | None = None) -> dict:
    body = json.dumps({"method": method, "params": params or {}}).encode("utf-8")
    req = urllib.request.Request(MCP_URL, data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=20) as resp:
        return json.loads(resp.read().decode("utf-8"))


def main() -> int:
    print(f"Agent MCP endpoint (zero-rewrite): {MCP_URL}")
    tools = mcp_call("tools/list").get("tools") or []
    print("Tools:", [t.get("name") for t in tools])

    scenarios = [
        ("tools/call", {"name": "read_invoice", "arguments": {"invoice_id": "1001"}, "intent": "Review invoice"}),
        ("tools/call", {"name": "post_payment", "arguments": {"amount": 5000, "vendor": "acme"}, "intent": "Pay vendor"}),
        (
            "tools/call",
            {
                "name": "post_payment",
                "arguments": {"amount": 5000, "vendor": "acme", "approved": True},
                "intent": "Pay vendor (CFO approved)",
            },
        ),
    ]

    exit_code = 0
    for method, params in scenarios:
        print("\n---", params.get("name"), "---")
        try:
            result = mcp_call(method, params)
            gov = result.get("governance") or {}
            decision = gov.get("decision", "UNKNOWN")
            receipt = gov.get("universal_action_receipt") or {}
            print(json.dumps({"decision": decision, "receipt_id": receipt.get("receipt_id")}, indent=2))
            if params.get("name") == "post_payment" and params.get("arguments", {}).get("approved") is not True:
                if decision != "BLOCK":
                    print("ERROR: expected BLOCK for unapproved post_payment", file=sys.stderr)
                    exit_code = 1
            if params.get("name") == "read_invoice" and decision != "ALLOW":
                print("ERROR: expected ALLOW for read_invoice", file=sys.stderr)
                exit_code = 1
        except Exception as exc:
            print(f"FAIL: {exc}", file=sys.stderr)
            exit_code = 1
    return exit_code


if __name__ == "__main__":
    sys.exit(main())
