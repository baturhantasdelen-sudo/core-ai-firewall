#!/usr/bin/env python3
"""Phase 1 sidecar — passport, outcome verification, UAR 2.0 sealing."""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from typing import Any

try:
    import yaml
except ImportError:
    yaml = None  # type: ignore

_PKG = Path(os.environ.get("NEXUS_SHIELD_PKG", "/app/packages/python"))
if _PKG.is_dir() and str(_PKG) not in sys.path:
    sys.path.insert(0, str(_PKG))

from nexus_shield.outcome_verifier import verify_outcome
from nexus_shield.passport import AgentPassport, validate_passport
from nexus_shield.uar_verify import build_uar_v2_receipt


def _load_policy() -> dict[str, Any]:
    path = Path(os.environ.get("POLICY_FILE", "/app/examples/nexus-shield-reference/policy.yaml"))
    if not path.is_file():
        raise FileNotFoundError(path)
    if yaml is None:
        raise RuntimeError("PyYAML required — pip install pyyaml")
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError("policy.yaml root must be mapping")
    return data


def _passport_for(agent_id: str, policy: dict[str, Any]) -> AgentPassport:
    passports = policy.get("passports") or {}
    raw = passports.get(agent_id)
    if not raw:
        raise KeyError(f"no passport for agent_id={agent_id}")
    merged = dict(raw)
    merged["agent_id"] = agent_id
    return AgentPassport.from_dict(merged)


def _fetch_state(base: str) -> dict[str, Any]:
    with urllib.request.urlopen(f"{base.rstrip('/')}/state", timeout=5) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    return data.get("state") or {}


def _call_mock_api(
    tool: str, params: dict[str, Any], base: str
) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
    state_before = _fetch_state(base)
    route = f"{base.rstrip('/')}/tools/{tool}"
    payload = json.dumps(params).encode("utf-8")
    req = urllib.request.Request(route, data=payload, headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            execution: dict[str, Any] = {"status_code": resp.status, **json.loads(resp.read().decode("utf-8"))}
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8")
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            parsed = {"error": raw}
        execution = {"status_code": exc.code, **parsed}
    state_after = _fetch_state(base)
    return state_before, execution, state_after


class Handler(BaseHTTPRequestHandler):
    policy: dict[str, Any] = {}
    mock_api_url: str = "http://mock-api:8300"

    def log_message(self, fmt: str, *args: object) -> None:
        print(f"[accountability-sidecar] {fmt % args}")

    def _json(self, code: int, payload: dict[str, Any]) -> None:
        data = json.dumps(payload, default=str).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self) -> None:
        if self.path.rstrip("/") == "/healthz":
            self._json(200, {"status": "HEALTHY", "service": "accountability-sidecar"})
            return
        self._json(404, {"detail": "not found"})

    def do_POST(self) -> None:
        if self.path.rstrip("/") != "/v1/accountability":
            self._json(404, {"detail": "not found"})
            return
        length = int(self.headers.get("Content-Length", 0))
        try:
            body = json.loads(self.rfile.read(length).decode("utf-8"))
        except json.JSONDecodeError:
            self._json(400, {"detail": "invalid json"})
            return

        agent_id = str(body.get("agent_id") or "")
        intent = str(body.get("intent") or "")
        tool = str(body.get("tool") or "")
        params = body.get("params") or {}
        system = str(body.get("system") or "mock-erp")
        agent_claim = str(body.get("agent_claim") or "SUCCESS")
        if not agent_id or not tool:
            self._json(400, {"detail": "agent_id and tool required"})
            return
        if not isinstance(params, dict):
            self._json(400, {"detail": "params must be object"})
            return

        try:
            passport = _passport_for(agent_id, Handler.policy)
        except (KeyError, ValueError) as exc:
            self._json(403, {"detail": str(exc), "decision": "BLOCK"})
            return

        requested = {"tool": tool, "system": system, "params": params}
        if not validate_passport(passport, requested):
            receipt = build_uar_v2_receipt(
                agent_passport=passport.summary(),
                intent=intent,
                action={"tool": tool, "system": system, "params": params},
                state_before={},
                state_after={},
                outcome_verification={"status": "UNVERIFIED", "reason": "passport validation failed"},
                decision="BLOCK",
            )
            self._json(403, {"decision": "BLOCK", "reason": "passport_validation_failed", "uar": receipt})
            return

        state_before, execution, state_after = _call_mock_api(tool, params, Handler.mock_api_url)
        outcome = verify_outcome(agent_claim, execution, state_after, state_before=state_before)
        decision = "ALLOW" if int(execution.get("status_code", 500)) < 400 else "BLOCK"
        receipt = build_uar_v2_receipt(
            agent_passport=passport.summary(),
            intent=intent,
            action={"tool": tool, "system": system, "params": params},
            state_before=state_before,
            state_after=state_after,
            outcome_verification=outcome,
            decision=decision,
        )
        self._json(200, {"decision": decision, "outcome": outcome, "uar": receipt, "execution": execution})


def main() -> None:
    Handler.policy = _load_policy()
    Handler.mock_api_url = os.environ.get("MOCK_API_URL", "http://mock-api:8300")
    host = os.environ.get("BIND_HOST", "0.0.0.0")
    port = int(os.environ.get("BIND_PORT", "8092"))
    print(f"Accountability sidecar on {host}:{port}", flush=True)
    HTTPServer((host, port), Handler).serve_forever()


if __name__ == "__main__":
    main()
