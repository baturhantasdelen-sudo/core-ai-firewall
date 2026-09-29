#!/usr/bin/env python3
"""
Nexus Shield Action Verifier — governance check + UAR (SHA-256) for GitHub Actions.

Calls the data plane ``POST /v1/intercept`` when reachable; otherwise evaluates with
the bundled harness policy engine and seals a deterministic offline receipt.
"""

from __future__ import annotations

import hashlib
import json
import os
import sys
import urllib.error
import urllib.request
import uuid
from pathlib import Path
from typing import Any

TOOL_ALIASES = {
    "export_db": "export_customer_database",
}


def _sha256(payload: str) -> str:
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _decision_to_status(decision: str) -> str:
    d = (decision or "BLOCK").upper()
    if d == "ALLOW":
        return "Passed"
    if d in ("REQUIRE_APPROVAL", "HUMAN_APPROVAL_REQUIRED"):
        return "Requires Approval"
    if d == "READ_ONLY":
        return "Requires Approval"
    return "Blocked"


def _write_github_output(name: str, value: str) -> None:
    out_path = os.environ.get("GITHUB_OUTPUT")
    if out_path:
        with open(out_path, "a", encoding="utf-8") as fh:
            fh.write(f"{name}={value}\n")
    else:
        print(f"{name}={value}")


def _load_policy_engine():
    action_path = Path(os.environ.get("GITHUB_ACTION_PATH", Path(__file__).resolve().parents[3]))
    harness_root = action_path / "harness"
    if harness_root.is_dir() and str(harness_root) not in sys.path:
        sys.path.insert(0, str(harness_root))
    from core.policy_engine import evaluate_proposed_action

    return evaluate_proposed_action


def _parse_tool_payload(raw: str) -> tuple[str, dict[str, Any]]:
    data = json.loads(raw)
    if not isinstance(data, dict):
        raise ValueError("tool_call_payload must be a JSON object")
    name = data.get("name") or data.get("tool")
    if not name or not isinstance(name, str):
        raise ValueError('tool_call_payload requires "name" (tool name)')
    args = data.get("args") or data.get("params") or {}
    if not isinstance(args, dict):
        raise ValueError('"args" must be a JSON object')
    tool = TOOL_ALIASES.get(name, name)
    return tool, args


def _offline_receipt(
    *,
    agent_id: str,
    intent: str,
    tool: str,
    params: dict[str, Any],
) -> tuple[str, str, str]:
    evaluate = _load_policy_engine()
    evaluation = evaluate(
        agent_id=agent_id,
        intent=intent,
        tool=tool,
        params=params,
        identity_verified=False,
    )
    receipt = evaluation["receipt"]
    decision = evaluation["decision"]
    receipt_id = receipt.get("receipt_id") or f"uar_{uuid.uuid4().hex[:16]}"
    evidence = receipt.get("evidence_bundle_hash") or _sha256(json.dumps(receipt, sort_keys=True))
    return receipt_id, evidence, decision


def _call_intercept(
    endpoint: str,
    *,
    agent_id: str,
    intent: str,
    tool: str,
    params: dict[str, Any],
) -> dict[str, Any] | None:
    url = f"{endpoint.rstrip('/')}/v1/intercept"
    body = json.dumps(
        {
            "tenant_id": "tnt_default",
            "agent_id": agent_id,
            "user_intent": intent,
            "tool": tool,
            "params": params,
        }
    ).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=8) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError):
        return None


def main() -> int:
    intent = os.environ.get("INPUT_AGENT_INTENT", "").strip()
    payload_raw = os.environ.get("INPUT_TOOL_CALL_PAYLOAD", "").strip()
    endpoint = os.environ.get("INPUT_POLICY_ENDPOINT", "http://localhost:8090").strip()

    if not intent:
        print("agent_intent is required", file=sys.stderr)
        return 1
    if not payload_raw:
        print("tool_call_payload is required", file=sys.stderr)
        return 1

    try:
        tool, params = _parse_tool_payload(payload_raw)
    except (json.JSONDecodeError, ValueError) as exc:
        print(f"Invalid tool_call_payload: {exc}", file=sys.stderr)
        return 1

    agent_id = os.environ.get("GITHUB_REPOSITORY", "github:agent") + ":workflow-agent"

    payload = _call_intercept(
        endpoint,
        agent_id=agent_id,
        intent=intent,
        tool=tool,
        params=params,
    )

    if payload:
        receipt = payload.get("universal_action_receipt") or {}
        uar = payload.get("uar") or {}
        crypto = payload.get("cryptography") or {}
        decision = (
            payload.get("decision")
            or receipt.get("decision")
            or uar.get("decision")
            or "BLOCK"
        )
        receipt_id = (
            uar.get("receipt_id")
            or receipt.get("receipt_id")
            or crypto.get("receipt_id")
            or f"uar_{uuid.uuid4().hex[:16]}"
        )
        evidence = (
            uar.get("evidence_hash")
            or receipt.get("evidence_bundle_hash")
            or crypto.get("evidence_bundle_sha256")
        )
        uar_receipt_id = evidence or receipt_id
    else:
        receipt_id, evidence, decision = _offline_receipt(
            agent_id=agent_id,
            intent=intent,
            tool=tool,
            params=params,
        )
        uar_receipt_id = evidence
        print(
            f"Policy endpoint unreachable ({endpoint}); sealed offline UAR via harness policy engine.",
            file=sys.stderr,
        )

    status = _decision_to_status(str(decision))
    summary = {
        "receipt_id": receipt_id,
        "uar_receipt_id": uar_receipt_id,
        "verification_status": status,
        "decision": str(decision).upper(),
        "tool": tool,
        "agent_intent": intent,
    }
    print(json.dumps(summary, indent=2))

    _write_github_output("uar_receipt_id", uar_receipt_id)
    _write_github_output("verification_status", status)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
