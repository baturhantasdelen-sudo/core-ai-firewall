#!/usr/bin/env python3
"""In-memory mock ERP API for Phase 1 accountability demo."""

from __future__ import annotations

import json
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Any

STATE: dict[str, Any] = {
    "invoices": {"1001": {"status": "OPEN", "amount": 1200.0}},
    "payments": {},
}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt: str, *args: object) -> None:
        print(f"[mock-api] {fmt % args}")

    def _json(self, code: int, payload: dict[str, Any]) -> None:
        data = json.dumps(payload).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self) -> None:
        if self.path.rstrip("/") == "/healthz":
            self._json(200, {"status": "HEALTHY"})
            return
        if self.path.startswith("/state"):
            self._json(200, {"state": STATE})
            return
        self._json(404, {"error": "not_found"})

    def do_POST(self) -> None:
        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length).decode("utf-8")) if length else {}
        if self.path.rstrip("/") == "/tools/read_invoice":
            inv_id = str(body.get("invoice_id", ""))
            inv = STATE["invoices"].get(inv_id)
            if not inv:
                self._json(404, {"status": "NOT_FOUND", "body": {}})
                return
            self._json(200, {"status": "SUCCESS", "body": {"invoice": inv}})
            return
        if self.path.rstrip("/") == "/tools/post_payment":
            amount = float(body.get("amount", 0))
            payment_id = f"pay_{len(STATE['payments']) + 1}"
            STATE["payments"][payment_id] = {"amount": amount, "status": "PAID"}
            inv_id = body.get("invoice_id")
            if inv_id and inv_id in STATE["invoices"]:
                STATE["invoices"][inv_id]["status"] = "PAID"
            self._json(200, {"status": "PAID", "body": {"payment_id": payment_id}})
            return
        self._json(400, {"status": "FAILED", "error": "unknown_route"})


def main() -> None:
    HTTPServer(("0.0.0.0", 8300), Handler).serve_forever()


if __name__ == "__main__":
    main()
