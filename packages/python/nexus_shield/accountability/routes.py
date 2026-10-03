"""Accountability HTTP API — receipts, blast radius, delegation audit."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field

from nexus_shield.accountability.context import get_accountability_context
from nexus_shield.core.blast_radius import BlastRadiusSimulator
from nexus_shield.sdk.decorators import run_secure_agent_action


class PaymentExecuteRequest(BaseModel):
    amount: float = Field(gt=0)
    target_resource: str = Field(min_length=1)
    raw_prompt: str = Field(min_length=1)
    apply_state_change: bool = True


def create_accountability_router() -> APIRouter:
    router = APIRouter(prefix="/v1/accountability", tags=["accountability"])

    @router.get("/receipts")
    def list_receipts(status: str | None = Query(default=None)) -> dict[str, Any]:
        store = get_accountability_context().store
        return {"receipts": store.list_receipts(status=status)}

    @router.get("/receipts/{receipt_id}")
    def get_receipt(receipt_id: str) -> dict[str, Any]:
        doc = get_accountability_context().store.get_receipt(receipt_id)
        if doc is None:
            raise HTTPException(status_code=404, detail="receipt not found")
        return doc

    @router.get("/incidents")
    def list_incidents() -> dict[str, Any]:
        return {"incidents": get_accountability_context().store.list_incidents()}

    @router.get("/audit-trail")
    def audit_trail() -> dict[str, Any]:
        return {"events": get_accountability_context().store.list_audit_trail()}

    @router.get("/blast-radius")
    def blast_radius_report() -> dict[str, Any]:
        ctx = get_accountability_context()
        sim: BlastRadiusSimulator | None = getattr(ctx, "blast_radius_simulator", None)
        if sim is None:
            sim = BlastRadiusSimulator()
        return sim.simulate().to_dict()

    @router.get("/blast-radius/what-if")
    def blast_radius_what_if(tool: str = Query(min_length=1)) -> dict[str, Any]:
        ctx = get_accountability_context()
        sim: BlastRadiusSimulator | None = getattr(ctx, "blast_radius_simulator", None)
        if sim is None:
            raise HTTPException(status_code=404, detail="blast radius simulator not configured")
        return sim.what_if_remove_tool(tool).to_dict()

    @router.get("/delegation")
    def delegation_view() -> dict[str, Any]:
        ctx = get_accountability_context()
        graph = ctx.delegation_graph
        if graph is None:
            raise HTTPException(status_code=404, detail="delegation graph not configured")
        root = graph.root
        nodes: list[dict[str, Any]] = [
            {
                "agent_id": root.agent_id,
                "role": "root",
                "allowed_scopes": sorted(root.allowed_scopes),
                "financial_limit": root.financial_limit,
            }
        ]
        parent_map = graph._parent or {}
        for delegatee, delegator in parent_map.items():
            node = graph.effective_node(delegatee)
            nodes.append(
                {
                    "agent_id": node.agent_id,
                    "role": "delegatee",
                    "parent": delegator,
                    "allowed_scopes": sorted(node.allowed_scopes),
                    "financial_limit": node.financial_limit,
                }
            )
        return {
            "root": root.agent_id,
            "nodes": nodes,
            "audit": ctx.store.list_audit_trail(),
        }

    def _payment_core(**kwargs: Any) -> dict[str, Any]:
        ctx = get_accountability_context()
        apply_change = bool(kwargs.get("apply_state_change", True))
        target = str(kwargs["target_resource"])
        if apply_change and ctx.db_connector is not None and hasattr(ctx.db_connector, "set_resource_state"):
            ctx.db_connector.set_resource_state(target, {"status": "PAID"})  # type: ignore[attr-defined]
        if (
            apply_change
            and ctx.ledger_connector is not None
            and hasattr(ctx.ledger_connector, "apply_payment")
        ):
            amount = float(kwargs.get("amount") or 0)
            ctx.ledger_connector.apply_payment(target, amount)  # type: ignore[attr-defined]
        return {"status_code": 200, "raw_body": '{"status":"succeeded"}'}

    @router.post("/execute-payment")
    async def execute_payment(body: PaymentExecuteRequest, request: Request) -> dict[str, Any]:
        passport = getattr(request.state, "nexus_passport", None)
        if passport is None:
            raise HTTPException(status_code=401, detail="passport not validated by gateway")

        state_before: dict[str, Any] = {"invoice_status": "PENDING", "ledger_balance": 150_000.0}
        ctx = get_accountability_context()
        if ctx.db_connector is not None:
            state = ctx.db_connector.get_resource_state(body.target_resource)
            state_before["invoice_status"] = state.get("status", "PENDING")
        if ctx.ledger_connector is not None:
            ledger = ctx.ledger_connector.get_latest_transaction(body.target_resource)
            state_before["ledger_balance"] = ledger.get("balance", 150_000.0)

        return run_secure_agent_action(
            passport.passport_id,
            ["payments:write"],
            _payment_core,
            amount=body.amount,
            target_resource=body.target_resource,
            raw_prompt=body.raw_prompt,
            apply_state_change=body.apply_state_change,
            state_snapshot_before=state_before,
            tool_called="stripe_create_transfer",
            request_payload={"amount": int(body.amount * 100), "currency": "usd"},
        )

    return router
