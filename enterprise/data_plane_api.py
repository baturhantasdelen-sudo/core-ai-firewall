"""
Nexus Data Plane API — self-hostable runtime (air-gapped).

Optional Nexus Cloud (`NEXUS_CLOUD_CONNECT=true`) for license sync / threat signatures only.

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
    title="Nexus Shield Data Plane",
    description="Self-hostable action governance runtime (UAR + policy). Cloud connect optional.",
    version="1.0.0",
)

_panel: CloudPanelService | None = None
_bootstrap_actor: str | None = None


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
    return {
        "status": "ok",
        "mode": "airgap" if NEXUS_AIRGAP else "connected",
        "nexus_cloud_connect": NEXUS_CLOUD_CONNECT,
        "data_plane": "nexus-runtime",
    }


@app.post("/v1/intercept")
def intercept(body: InterceptRequest) -> dict[str, Any]:
    panel = _get_panel()
    actor = body.actor_user_id or _bootstrap_actor
    if not actor:
        raise HTTPException(status_code=503, detail="No actor_user_id; enable NEXUS_DATA_PLANE_BOOTSTRAP")
    return panel.process_agent_action(
        actor_user_id=actor,
        tenant_id=body.tenant_id,
        agent_id=body.agent_id,
        intent=body.user_intent,
        tool=body.tool,
        params=body.params,
        identity_verified=body.identity_verified,
        dispatch_siem=body.dispatch_siem,
    )


@app.get("/v1/receipts/{receipt_id}")
def get_receipt(receipt_id: str, tenant_id: str = "tnt_default", actor_user_id: str | None = None) -> dict[str, Any]:
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
    panel = _get_panel()
    return panel.verify_receipt_by_id(receipt_id=receipt_id, evidence_bundle_hash=evidence_bundle_hash)
