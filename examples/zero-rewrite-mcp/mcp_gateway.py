#!/usr/bin/env python3
"""
MCP gateway — zero-rewrite integration point.

Point the agent's MCP URL here; tool calls are intercepted by the policy sidecar
before forwarding to the upstream mock MCP server.
"""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, HTTPServer

INTERCEPT_URL = os.environ.get("NEXUS_INTERCEPT_URL", "http://policy-sidecar:8091/v1/intercept")
UPSTREAM_MCP = os.environ.get("UPSTREAM_MCP_URL", "http://mock-mcp:8100")
AGENT_ID = os.environ.get("AGENT_ID", "zero-rewrite-demo:agent-01")


def _post_json(url: str, payload: dict) -> dict:
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode("utf-8"))


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt: str, *args: object) -> None:
        print(f"[mcp-gateway] {fmt % args}")

    def do_POST(self) -> None:
        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length).decode("utf-8"))
        method = body.get("method")
        try:
            if method == "tools/list":
                payload = _post_json(UPSTREAM_MCP, body)
            elif method == "tools/call":
                params = body.get("params") or {}
                tool = str(params.get("name") or "")
                tool_params = params.get("arguments") or params.get("params") or {}
                if not isinstance(tool_params, dict):
                    tool_params = {}
                intent = str(params.get("intent") or f"Invoke MCP tool {tool}")
                gov = _post_json(
                    INTERCEPT_URL,
                    {
                        "agent_id": AGENT_ID,
                        "user_intent": intent,
                        "tool": tool,
                        "params": tool_params,
                    },
                )
                decision = gov.get("decision")
                receipt = gov.get("universal_action_receipt") or {}
                if decision != "ALLOW":
                    payload = {
                        "content": [
                            {
                                "type": "text",
                                "text": json.dumps(
                                    {
                                        "blocked": True,
                                        "decision": decision,
                                        "receipt_id": receipt.get("receipt_id"),
                                        "evidence_bundle_hash": receipt.get("evidence_bundle_hash"),
                                    }
                                ),
                            }
                        ],
                        "isError": True,
                        "governance": gov,
                    }
                else:
                    upstream = _post_json(UPSTREAM_MCP, body)
                    payload = {**upstream, "governance": gov}
            else:
                payload = {"error": "unknown_method"}
        except urllib.error.URLError as exc:
            payload = {"error": "gateway_upstream_failed", "detail": str(exc)}
        data = json.dumps(payload).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


def main() -> None:
    port = int(os.environ.get("GATEWAY_PORT", "8200"))
    HTTPServer(("0.0.0.0", port), Handler).serve_forever()


if __name__ == "__main__":
    main()
