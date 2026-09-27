"""
Nexus Data Plane API — AI Agent Action Governance & Verification (self-hosted).

Core tagline:
  Know what your agents are allowed to do. Stop what they shouldn't. Prove what actually happened.

This service is the **nexus** runtime: policy evaluation, UAR sealing, and local ledger persistence.
Optional Nexus Cloud (`NEXUS_CLOUD_CONNECT=true`) is **nexus-control** only — license sync / signatures;
it is not required for governance or proof.

Universal Action Receipt (UAR) — primary response object
--------------------------------------------------------
Each successful ``POST /v1/intercept`` (every governed action attempt — ALLOW, BLOCK, READ_ONLY,
REQUIRE_APPROVAL) returns:

- ``universal_action_receipt`` — canonical stored receipt
- ``intent_divergence`` — ``risk_score``, ``violations`` (governance context)
- ``cryptography`` — ``receipt_id``, ``evidence_bundle_sha256`` (``evidence_hash``), verify URL

Canonical UAR fields: ``receipt_id``, ``agent_id`` (``agent.id``), ``intent``, ``decision``,
``execution_state``, ``evidence_hash`` (``evidence_bundle_hash``). See ``docs/UAR_SCHEMA.md``.

Proof Center lanes (do not conflate):
- **Benchmark results** — ``nexus-harness-benchmark``; evidence bundle per evaluated harness step
- **UAR ledger** — this API + ``enterprise/data/uar_receipts.jsonl`` (not the same as block counts)

Usage:
    uvicorn enterprise.data_plane_api:app --host 0.0.0.0 --port 8090
"""

from __future__ import annotations

import os
from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from enterprise.cloud_panel import CloudPanelService
from enterprise.tenant_manager import Role, TenantManager
from enterprise.uar_store import LocalUarStore

NEXUS_CLOUD_CONNECT = os.getenv("NEXUS_CLOUD_CONNECT", "false").lower() in ("1", "true", "yes")
NEXUS_AIRGAP = os.getenv("NEXUS_AIRGAP", "true").lower() in ("1", "true", "yes")

app = FastAPI(
    title="Nexus Data Plane (nexus)",
    description=(
        "AI Agent Action Governance & Verification Platform — data plane runtime. "
        "Returns Universal Action Receipts (UAR) with SHA-256 evidence_hash. "
        "Optional Nexus Cloud control plane; air-gapped by default."
    ),
    version="1.0.0",
)

_panel: CloudPanelService | None = None
_bootstrap_actor: str | None = None


def _uar_envelope(result: dict[str, Any]) -> dict[str, Any]:
    """Normalize intercept response with canonical UAR + intent_divergence fields."""
    receipt = result.get("universal_action_receipt") or {}
    agent = receipt.get("agent") or {}
    crypto = result.get("cryptography") or {}
    return {
        **result,
        "intent_divergence": {
            "risk_score": result.get("risk_score"),
            "violations": result.get("violations") or [],
        },
        "uar": {
            "receipt_id": receipt.get("receipt_id") or crypto.get("receipt_id"),
            "agent_id": agent.get("id"),
            "intent": receipt.get("intent"),
            "decision": result.get("decision") or receipt.get("decision"),
            "execution_state": receipt.get("execution_state"),
            "evidence_hash": receipt.get("evidence_bundle_hash") or crypto.get("evidence_bundle_sha256"),
        },
    }


def _get_panel() -> CloudPanelService:
    global _panel, _bootstrap_actor
    if _panel is None:
        _panel = CloudPanelService(
            tenant_manager=TenantManager(),
        )
        _panel.receipt_store = LocalUarStore()
        if os.getenv("NEXUS_DATA_PLANE_BOOTSTRAP", "false").lower() in ("1", "true", "yes"):
            _panel.tenant_manager.create_tenant("Default Tenant", tenant_id="tnt_default")
            user = _panel.tenant_manager.assign_user("tnt_default", "runtime@local", Role.SECURITY_ENGINEER)
            _bootstrap_actor = user.user_id
            _panel.tenant_manager.register_agent("tnt_default", "tnt_default:agent-01")
    return _panel


class InterceptRequest(BaseModel):
    """Proposed agent tool call — evaluated into a UAR."""

    tenant_id: str = "tnt_default"
    actor_user_id: str | None = None
    agent_id: str = "tnt_default:agent-01"
    user_intent: str
    tool: str
    params: dict[str, Any] = Field(default_factory=dict)
    identity_verified: bool = False
    dispatch_siem: bool = False


@app.get("/healthz")
def healthz() -> dict[str, Any]:
    """Liveness — data plane does not require Nexus Cloud."""
    return {
        "status": "ok",
        "platform": "AI Agent Action Governance & Verification",
        "mode": "airgap" if NEXUS_AIRGAP else "connected",
        "nexus_cloud_connect": NEXUS_CLOUD_CONNECT,
        "data_plane": "nexus-runtime",
        "primary_object": "Universal Action Receipt (UAR)",
    }


@app.post("/v1/intercept")
def intercept(body: InterceptRequest) -> dict[str, Any]:
    """
    Govern a proposed tool call: policy check → decision → UAR + evidence_hash.

    Response includes ``universal_action_receipt``, ``intent_divergence``, and flat ``uar`` summary.
    """
    panel = _get_panel()
    actor = body.actor_user_id or _bootstrap_actor
    if not actor:
        raise HTTPException(status_code=503, detail="No actor_user_id; enable NEXUS_DATA_PLANE_BOOTSTRAP")
    result = panel.process_agent_action(
        actor_user_id=actor,
        tenant_id=body.tenant_id,
        agent_id=body.agent_id,
        intent=body.user_intent,
        tool=body.tool,
        params=body.params,
        identity_verified=body.identity_verified,
        dispatch_siem=body.dispatch_siem,
    )
    return _uar_envelope(result)


@app.get("/v1/receipts/{receipt_id}")
def get_receipt(receipt_id: str, tenant_id: str = "tnt_default", actor_user_id: str | None = None) -> dict[str, Any]:
    """Fetch a UAR from the local ledger by ``receipt_id`` (RBAC)."""
    panel = _get_panel()
    actor = actor_user_id or _bootstrap_actor
    if not actor:
        raise HTTPException(status_code=503, detail="actor required")
    return panel.get_receipt_by_id(
        actor_user_id=actor,
        tenant_id=tenant_id,
        receipt_id=receipt_id,
    )


@app.get("/v1/receipts/{receipt_id}/verify")
def verify_receipt(
    receipt_id: str,
    evidence_bundle_hash: str | None = None,
) -> dict[str, Any]:
    """
    Proof Center verification — recompute SHA-256 ``evidence_hash`` for ``receipt_id``.

    Optional query ``evidence_bundle_hash`` must match the sealed UAR.
    """
    panel = _get_panel()
    return panel.verify_receipt_by_id(receipt_id=receipt_id, evidence_bundle_hash=evidence_bundle_hash)
