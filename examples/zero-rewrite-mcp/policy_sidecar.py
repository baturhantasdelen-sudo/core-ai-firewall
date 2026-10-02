#!/usr/bin/env python3
"""Minimal policy enforcement sidecar — POST /v1/intercept + UAR sealing."""

from __future__ import annotations

import hashlib
import json
import os
import uuid
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from typing import Any

try:
    import yaml
except ImportError:
    yaml = None  # type: ignore


def _sha256(payload: str) -> str:
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _load_policy() -> dict[str, Any]:
    path = Path(os.environ.get("POLICY_FILE", "/app/policy.yaml"))
    if not path.is_file():
        raise FileNotFoundError(f"Policy file not found: {path}")
    text = path.read_text(encoding="utf-8")
    if yaml is not None:
        data = yaml.safe_load(text)
    else:
        raise RuntimeError("PyYAML required — pip install pyyaml")
    if not isinstance(data, dict):
        raise ValueError("policy.yaml root must be a mapping")
    return data


def _evaluate(policy: dict[str, Any], tool: str, params: dict[str, Any]) -> tuple[str, str]:
    tools = policy.get("tools") or {}
    rule = tools.get(tool)
    if not rule:
        return str(policy.get("default_decision", "BLOCK")), str(policy.get("default_rule_id", "DEFAULT_DENY"))
    decision = str(rule.get("decision", "BLOCK"))
    rule_id = str(rule.get("rule_id", "POLICY_RULE"))
    unless = rule.get("unless") or {}
    if unless and params.get("approved") is True:
        return "ALLOW", f"{rule_id}_APPROVED"
    return decision, rule_id


def _build_uar(
    *,
    agent_id: str,
    intent: str,
    tool: str,
    params: dict[str, Any],
    decision: str,
    rule_id: str,
) -> dict[str, Any]:
    ts = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    receipt_id = f"uar_{uuid.uuid4().hex[:16]}"
    before = _sha256(f"before:{agent_id}:{tool}")
    after = _sha256(f"after:{agent_id}:{decision}:{json.dumps(params, sort_keys=True)}")
    exec_status = "blocked" if decision == "BLOCK" else "executed" if decision == "ALLOW" else "pending"
    receipt = {
        "receipt_id": receipt_id,
        "timestamp": ts,
        "agent": {"id": agent_id, "identity_verified": False},
        "intent": intent,
        "proposed_action": {"tool": tool, "params": params},
        "policy_evaluated": {"rule_id": rule_id, "action": decision},
        "decision": decision,
        "execution_state": {
            "before_hash": f"sha256:{before}",
            "after_hash": f"sha256:{after}",
            "execution_status": exec_status,
        },
    }
    core = {
        "receipt_id": receipt["receipt_id"],
        "timestamp": receipt["timestamp"],
        "agent": receipt["agent"],
        "intent": receipt["intent"],
        "proposed_action": receipt["proposed_action"],
        "policy_evaluated": receipt["policy_evaluated"],
        "decision": receipt["decision"],
        "execution_state": receipt["execution_state"],
    }
    bundle = _sha256(json.dumps(core, sort_keys=True))
    receipt["evidence_bundle_hash"] = bundle
    receipt["signature"] = bundle
    return receipt


class Handler(BaseHTTPRequestHandler):
    policy: dict[str, Any] = {}

    def log_message(self, fmt: str, *args: object) -> None:
        print(f"[policy-sidecar] {self.address_string()} {fmt % args}")

    def _json(self, code: int, payload: dict[str, Any]) -> None:
        data = json.dumps(payload).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self) -> None:
        if self.path.rstrip("/") == "/healthz":
            self._json(200, {"status": "HEALTHY", "service": "policy-sidecar"})
            return
        self._json(404, {"detail": "not found"})

    def do_POST(self) -> None:
        if self.path.rstrip("/") != "/v1/intercept":
            self._json(404, {"detail": "not found"})
            return
        length = int(self.headers.get("Content-Length", 0))
        try:
            body = json.loads(self.rfile.read(length).decode("utf-8"))
        except json.JSONDecodeError:
            self._json(400, {"detail": "invalid json"})
            return
        tool = str(body.get("tool") or "")
        params = body.get("params") or {}
        if not isinstance(params, dict):
            self._json(400, {"detail": "params must be object"})
            return
        intent = str(body.get("user_intent") or body.get("intent") or "")
        agent_id = str(body.get("agent_id") or Handler.policy.get("agent_id") or "agent:unknown")
        try:
            decision, rule_id = _evaluate(Handler.policy, tool, params)
        except Exception as exc:
            self._json(500, {"detail": str(exc)})
            return
        receipt = _build_uar(
            agent_id=agent_id,
            intent=intent,
            tool=tool,
            params=params,
            decision=decision,
            rule_id=rule_id,
        )
        self._json(
            200,
            {
                "decision": decision,
                "universal_action_receipt": receipt,
                "uar": {"receipt_id": receipt["receipt_id"], "evidence_hash": receipt["evidence_bundle_hash"]},
            },
        )


def main() -> None:
    Handler.policy = _load_policy()
    host = os.environ.get("BIND_HOST", "0.0.0.0")
    port = int(os.environ.get("BIND_PORT", "8091"))
    print(f"Policy sidecar listening on {host}:{port}", flush=True)
    HTTPServer((host, port), Handler).serve_forever()


if __name__ == "__main__":
    main()
