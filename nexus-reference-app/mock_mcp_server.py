#!/usr/bin/env python3
"""Minimal MCP-style tool server simulation (local JSON-RPC over HTTP)."""

from __future__ import annotations

import json
from http.server import BaseHTTPRequestHandler, HTTPServer


TOOLS = [
    {"name": "read_invoice", "description": "GET invoice by id"},
    {"name": "get_customer_profile", "description": "Fetch customer profile"},
    {"name": "query", "description": "SQL-like query tool"},
    {"name": "fetch", "description": "HTTP fetch tool"},
]


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt: str, *args: object) -> None:
        return

    def do_POST(self) -> None:
        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length).decode("utf-8"))
        method = body.get("method")
        if method == "tools/list":
            payload = {"tools": TOOLS}
        elif method == "tools/call":
            params = body.get("params") or {}
            payload = {
                "content": [{"type": "text", "text": f"simulated:{params.get('name')}"}],
                "isError": False,
            }
        else:
            payload = {"error": "unknown_method"}
        data = json.dumps(payload).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


def main() -> None:
    host, port = "0.0.0.0", 8100
    HTTPServer((host, port), Handler).serve_forever()


if __name__ == "__main__":
    main()
