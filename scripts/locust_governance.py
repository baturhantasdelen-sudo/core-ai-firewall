"""Locust load test — Agent Governance (/v1/agent/action, /v1/mcp/inspect).

Usage:
    locust -f scripts/locust_governance.py --host http://127.0.0.1:8080
"""

from __future__ import annotations

import json
from locust import HttpUser, between, task


class NexusGovernanceLoadUser(HttpUser):
    wait_time = between(0.05, 0.2)

    @task(3)
    def agent_action_benchmark(self) -> None:
        headers = {
            "Content-Type": "application/json",
            "X-Nexus-Agent-Id": "agent-benchmark",
            "X-Session-Id": "sess_bench_101",
        }
        payload = {
            "tool_name": "read_invoice",
            "arguments": {"invoice_id": "INV-2026-TEST"},
            "user_prompt": "Fatura detaylarını göster.",
            "tool_purpose": "Finansal verileri okuma.",
        }
        self.client.post("/v1/agent/action", json=payload, headers=headers, name="POST /v1/agent/action")

    @task(1)
    def mcp_inspect_benchmark(self) -> None:
        headers = {"Content-Type": "application/json"}
        payload = {
            "mcp_payload": {
                "method": "tools/call",
                "params": {
                    "name": "read_invoice",
                    "arguments": {"invoice_id": "INV-BENCH"},
                },
            },
            "agent_trust_score": 95.0,
            "divergence_score": 0.0,
        }
        self.client.post("/v1/mcp/inspect", json=payload, headers=headers, name="POST /v1/mcp/inspect")
