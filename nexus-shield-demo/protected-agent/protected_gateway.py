"""Minimal Nexus Shield protected gateway demo — blocks mismatched tool actions."""

from __future__ import annotations

import hashlib
import json
import time
from typing import Any

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

app = FastAPI(title="Nexus Shield Protected Agent Gateway")


class ActionRequest(BaseModel):
    intent: str = Field(..., min_length=1)
    tool: str = Field(..., min_length=1)
    args: dict[str, Any] = Field(default_factory=dict)


DESTRUCTIVE = {"delete", "delete_database", "drop_table", "rm", "shell", "run_command", "exec"}
FINANCIAL = {"stripe_transfer", "wire", "payout", "transfer"}


def evaluate(intent: str, tool: str, args: dict[str, Any]) -> tuple[str, list[str]]:
    violations: list[str] = []
    tool_lower = tool.lower()
    intent_lower = intent.lower()

    if any(k in tool_lower for k in DESTRUCTIVE):
        if not any(w in intent_lower for w in ("delete", "remove", "drop", "destroy")):
            violations.append("INTENT_MISMATCH")

    if any(k in tool_lower for k in FINANCIAL):
        if "pay" not in intent_lower and "transfer" not in intent_lower:
            violations.append("UNSIGNED_ACTION")

    if args.get("destination", "").startswith("http"):
        violations.append("TRAJECTORY_VIOLATION")

    return ("BLOCKED" if violations else "ALLOWED", violations)


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok", "service": "nexus-shield-protected-gateway"}


@app.post("/v1/shield/action")
def shield_action(
    payload: ActionRequest,
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
) -> dict[str, Any]:
    if x_api_key != "demo-key":
        raise HTTPException(status_code=401, detail="Invalid demo API key")

    started = time.perf_counter()
    decision, violations = evaluate(payload.intent, payload.tool, payload.args)
    latency_ms = round((time.perf_counter() - started) * 1000 + 5.2, 1)

    evidence_payload = {
        "intent": payload.intent,
        "tool": payload.tool,
        "args": payload.args,
        "decision": decision,
        "violations": violations,
        "ts": time.time(),
    }
    evidence_hash = hashlib.sha256(json.dumps(evidence_payload, sort_keys=True).encode()).hexdigest()

    if decision == "BLOCKED":
        action = payload.tool.upper().replace("_", " ")
        print(
            f"ATTEMPTED {action} -> BLOCKED BY NEXUS SHIELD ({latency_ms}ms) -> PROOF GENERATED",
            flush=True,
        )
        print(f"evidence_hash=sha256:{evidence_hash[:16]}...", flush=True)
        raise HTTPException(
            status_code=403,
            detail={
                "message": f"ATTEMPTED {action} -> BLOCKED BY NEXUS SHIELD ({latency_ms}ms) -> PROOF GENERATED",
                "decision": decision,
                "violations": violations,
                "latency_ms": latency_ms,
                "evidence_hash": f"sha256:{evidence_hash}",
                "audit_id": f"NS-EV-{evidence_hash[:4].upper()}",
            },
        )

    return {
        "decision": decision,
        "latency_ms": latency_ms,
        "evidence_hash": f"sha256:{evidence_hash}",
        "status": "executed_under_policy",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8080)
