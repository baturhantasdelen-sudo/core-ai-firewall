#!/usr/bin/env python3
"""Minimal stand-in for CRM/DB API the agent would call after policy ALLOW."""

from __future__ import annotations

import json
from http.server import BaseHTTPRequestHandler, HTTPServer


class Handler(BaseHTTPRequestHandler):
    def log_message(self, format: str, *args: object) -> None:
        return

    def do_GET(self) -> None:
        if self.path != "/healthz":
            self.send_error(404)
            return
        self._json({"status": "ok", "service": "mock-target-api"})

    def do_POST(self) -> None:
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length) if length else b"{}"
        try:
            payload = json.loads(body.decode("utf-8"))
        except json.JSONDecodeError:
            payload = {}
        if self.path == "/v1/export":
            self._json({"executed": True, "rows": 0, "note": "mock export blocked in demo unless ALLOW"})
            return
        self._json({"path": self.path, "received": payload})

    def _json(self, data: dict) -> None:
        raw = json.dumps(data).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)


if __name__ == "__main__":
    HTTPServer(("0.0.0.0", 8091), Handler).serve_forever()
