#!/usr/bin/env python3
"""
Nexus Shield Action Verifier — governance check + UAR (SHA-256) for GitHub Actions.

Integrates local memory ledger and self-healing policy evolution (air-gapped).
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


def _repo_root() -> Path:
    return Path(os.environ.get("GITHUB_ACTION_PATH", Path(__file__).resolve().parents[3])).resolve()


def _ensure_nexus_path() -> None:
    root = _repo_root()
    if str(root) not in sys.path:
        sys.path.insert(0, str(root))


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


def _handle_rollback() -> int:
    _ensure_nexus_path()
    os.environ.setdefault("NEXUS_REPO_ROOT", str(_repo_root()))
    from nexus.evolution import rollback_policy

    result = rollback_policy()
    print(json.dumps(result, indent=2))
    if result.get("ok"):
        _write_github_output("verification_status", "Rollback")
        _write_github_output("uar_receipt_id", result.get("rollback_uar", ""))
        return 0
    return 1


def main() -> int:
    if len(sys.argv) > 1 and sys.argv[1] == "rollback":
        return _handle_rollback()

    rollback_flag = os.environ.get("INPUT_ROLLBACK", "").strip().lower() in ("1", "true", "yes")
    if rollback_flag:
        return _handle_rollback()

    intent = os.environ.get("INPUT_AGENT_INTENT", "").strip()
    payload_raw = os.environ.get("INPUT_TOOL_CALL_PAYLOAD", "").strip()
    endpoint = os.environ.get("INPUT_POLICY_ENDPOINT", "http://localhost:8090").strip()
    feedback = os.environ.get("INPUT_FEEDBACK", "").strip().lower() or None

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

    _ensure_nexus_path()
    os.environ.setdefault("NEXUS_REPO_ROOT", str(_repo_root()))

    from nexus.govern import record_and_learn, run_self_healing_cycle

    agent_id = os.environ.get("GITHUB_REPOSITORY", "github:agent") + ":workflow-agent"

    payload = _call_intercept(
        endpoint,
        agent_id=agent_id,
        intent=intent,
        tool=tool,
        params=params,
    )
    endpoint_reachable = payload is not None

    healing: dict[str, Any] | None = None
    if not endpoint_reachable:
        healing = run_self_healing_cycle(
            agent_id=agent_id,
            intent=intent,
            tool=tool,
            params=params,
            endpoint_reachable=False,
            feedback=feedback,
        )
        receipt_id = healing["receipt_id"]
        uar_receipt_id = healing["uar_receipt_id"]
        decision = healing["decision"]
        print(
            f"Policy endpoint unreachable ({endpoint}); offline self-healing path engaged.",
            file=sys.stderr,
        )
    else:
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
        healing = record_and_learn(
            agent_id=agent_id,
            intent=intent,
            tool=tool,
            params=params,
            decision=str(decision),
            receipt_id=str(receipt_id),
            uar_receipt_id=str(uar_receipt_id),
            endpoint_reachable=True,
            feedback=feedback,
        )

    status = _decision_to_status(str(decision))
    summary = {
        "receipt_id": receipt_id,
        "uar_receipt_id": uar_receipt_id,
        "verification_status": status,
        "decision": str(decision).upper(),
        "tool": tool,
        "agent_intent": intent,
        "self_healing": healing,
    }
    print(json.dumps(summary, indent=2))

    _write_github_output("uar_receipt_id", uar_receipt_id)
    _write_github_output("verification_status", status)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
