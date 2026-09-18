#!/usr/bin/env python3
"""Run integration + quick load checks against Nexus Shield governance API."""

from __future__ import annotations

import argparse
import concurrent.futures
import json
import sys
import time
import urllib.error
import urllib.request


def post(host: str, path: str, payload: dict, headers: dict | None = None) -> tuple[int, dict, float]:
    merged_headers = {
        "Content-Type": "application/json",
        "User-Agent": "NexusShieldIntegrationSuite/1.0",
        "Accept": "application/json",
        **(headers or {}),
    }
    req = urllib.request.Request(
        host + path,
        data=json.dumps(payload).encode(),
        headers=merged_headers,
        method="POST",
    )
    started = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            body = response.read().decode()
            elapsed_ms = (time.perf_counter() - started) * 1000
            return response.status, json.loads(body), elapsed_ms
    except urllib.error.HTTPError as exc:
        body = exc.read().decode()
        elapsed_ms = (time.perf_counter() - started) * 1000
        try:
            data = json.loads(body)
        except json.JSONDecodeError:
            data = {"raw": body[:500]}
        return exc.code, data, elapsed_ms


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="https://api.nexusshield.ai")
    parser.add_argument("--load-requests", type=int, default=20)
    args = parser.parse_args()
    host = args.host.rstrip("/")

    print("=" * 50)
    print("   NEXUS SHIELD AI - INTEGRATION & LOAD SUITE")
    print("=" * 50)
    print(f"Target: {host}")

    print("\n[1/3] HITL Intent Mismatch")
    print("-" * 50)
    code, data, ms = post(
        host,
        "/v1/agent/action",
        {
            "tool_name": "read_invoice",
            "arguments": {"invoice_id": "INV-HITL-TEST"},
            "user_prompt": "Bugun Ankara hava durumu nasil?",
            "tool_purpose": "Finansal fatura detaylarini okur.",
        },
        {
            "X-Nexus-Agent-Id": "agent-integration-test",
            "X-Session-Id": "sess_hitl_integration_001",
        },
    )
    print(f"HTTP {code} ({ms:.0f} ms)")
    print(json.dumps(data, indent=2)[:1200])
    approval_id = data.get("approval_id")
    status = data.get("status")
    if status == "PENDING_APPROVAL" and approval_id:
        print(f"OK: approval_id={approval_id}")
    else:
        print(f"WARN: expected PENDING_APPROVAL, got status={status}")

    print("\n[2/3] MCP Security")
    print("-" * 50)
    mcp_cases = [
        (
            "DLP export_customer_pii",
            {
                "mcp_payload": {
                    "method": "tools/call",
                    "params": {
                        "name": "export_customer_pii",
                        "arguments": {"path": "/etc/passwd"},
                    },
                },
                "agent_trust_score": 95.0,
            },
        ),
        (
            "Low trust delete_records",
            {
                "mcp_payload": {
                    "method": "tools/call",
                    "params": {"name": "delete_records", "arguments": {}},
                },
                "agent_trust_score": 30.0,
            },
        ),
        (
            "Allowed read_invoice",
            {
                "mcp_payload": {
                    "method": "tools/call",
                    "params": {
                        "name": "read_invoice",
                        "arguments": {"invoice_id": "INV-1"},
                    },
                },
                "agent_trust_score": 95.0,
            },
        ),
    ]
    for label, payload in mcp_cases:
        code, data, ms = post(host, "/v1/mcp/inspect", payload)
        allowed = data.get("is_allowed")
        decision = data.get("decision")
        print(f"{label}: HTTP {code} is_allowed={allowed} decision={decision} ({ms:.0f} ms)")

    print("\n[3/3] Quick load")
    print("-" * 50)

    def bench(i: int) -> tuple[int, float]:
        status_code, _, elapsed_ms = post(
            host,
            "/v1/agent/action",
            {
                "tool_name": "read_invoice",
                "arguments": {"invoice_id": f"INV-B{i}"},
                "user_prompt": "Fatura oku.",
            },
            {
                "X-Nexus-Agent-Id": "agent-benchmark",
                "X-Session-Id": f"sess_bench_{i}",
            },
        )
        return status_code, elapsed_ms

    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        results = list(executor.map(bench, range(1, args.load_requests + 1)))

    ok_count = sum(1 for code, _ in results if code == 200)
    avg_ms = sum(ms for _, ms in results) / len(results)
    print(f"200 responses: {ok_count}/{len(results)} | avg_ms={avg_ms:.0f}")

    print("\n" + "=" * 50)
    print("   INTEGRATION & LOAD SUITE COMPLETE")
    print("=" * 50)
    return 0 if ok_count == len(results) and status == "PENDING_APPROVAL" else 1


if __name__ == "__main__":
    sys.exit(main())
