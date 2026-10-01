"""
Minimal MCP stdio bridge — forwards ``tools/call`` proposals to the local intercept sidecar.

Usage (see docs/integration-quickstart.md):
  NEXUS_INTERCEPT_URL=http://127.0.0.1:8090/v1/intercept python -m nexus.mcp_bridge
"""

from __future__ import annotations

import json
import os
import sys

from nexus import ActionShield


def _reply(msg_id: object, result: dict) -> None:
    sys.stdout.write(json.dumps({"jsonrpc": "2.0", "id": msg_id, "result": result}) + "\n")
    sys.stdout.flush()


def _error(msg_id: object, message: str) -> None:
    sys.stdout.write(
        json.dumps({"jsonrpc": "2.0", "id": msg_id, "error": {"code": -32000, "message": message}})
        + "\n"
    )
    sys.stdout.flush()


def main() -> int:
    shield = ActionShield(
        intercept_url=os.environ.get("NEXUS_INTERCEPT_URL", "http://127.0.0.1:8090/v1/intercept"),
        agent_id=os.environ.get("NEXUS_AGENT_ID", "mcp:stdio-bridge"),
    )
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        msg = json.loads(line)
        msg_id = msg.get("id")
        method = msg.get("method")
        if method == "initialize":
            _reply(msg_id, {"capabilities": {"tools": {}}})
        elif method == "tools/list":
            _reply(
                msg_id,
                {
                    "tools": [
                        {"name": "read_invoice", "description": "Read invoice by id"},
                        {"name": "get_customer_profile", "description": "Customer profile"},
                        {"name": "export_customer_database", "description": "Export DB"},
                        {"name": "fetch", "description": "HTTP fetch"},
                    ]
                },
            )
        elif method == "tools/call":
            params = msg.get("params") or {}
            name = params.get("name", "")
            args = params.get("arguments") or {}
            intent = os.environ.get("NEXUS_DEFAULT_INTENT", f"MCP tools/call {name}")
            receipt = shield.intercept(intent, name, args)
            decision = receipt.get("decision") or (receipt.get("uar") or {}).get("decision")
            uar = receipt.get("uar") or {}
            evidence = uar.get("evidence_hash") or uar.get("receipt_id")
            text = json.dumps({"decision": decision, "uar_evidence_sha256": evidence}, indent=2)
            _reply(msg_id, {"content": [{"type": "text", "text": text}], "isError": decision == "BLOCK"})
        else:
            _error(msg_id, f"unsupported method: {method}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
