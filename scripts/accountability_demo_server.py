#!/usr/bin/env python3
"""FastAPI accountability API for local demo recording (uvicorn entrypoint)."""

from __future__ import annotations

import sys
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parents[1]
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))
_PKG = _REPO_ROOT / "packages" / "python"
if str(_PKG) not in sys.path:
    sys.path.insert(0, str(_PKG))

from nexus_shield.accountability.app_factory import create_accountability_app
from nexus_shield.accountability.context import AccountabilityContext
from nexus_shield.core.blast_radius import BlastRadiusSimulator, ExposureEdge
from nexus_shield.core.delegation import DelegationGraph, DelegationNode
from nexus_shield.core.passport import AgentPassportRecord


class _MutableResourceDb:
    def __init__(self) -> None:
        self._states: dict[str, dict] = {}

    def seed(self, resource_id: str, status: str) -> None:
        self._states[resource_id] = {"status": status}

    def get_resource_state(self, resource_id: str) -> dict:
        return dict(self._states.get(resource_id, {"status": "PENDING"}))

    def set_resource_state(self, resource_id: str, state: dict) -> None:
        self._states[resource_id] = dict(state)


class _MutableLedger:
    def __init__(self, balance: float = 150_000.0) -> None:
        self._balance = balance

    def get_latest_transaction(self, resource_id: str) -> dict:
        return {"balance": self._balance, "resource_id": resource_id}

    def apply_payment(self, resource_id: str, amount: float) -> None:
        self._balance -= amount


def _build_demo_context() -> AccountabilityContext:
    db = _MutableResourceDb()
    db.seed("invoice_1024", "PENDING")
    ledger = _MutableLedger()

    root = DelegationNode(
        agent_id="human-root",
        allowed_scopes=frozenset({"invoices:read", "payments:write"}),
        financial_limit=10_000.0,
    )
    graph = DelegationGraph(root=root)
    graph.add_delegation(
        "human-root",
        DelegationNode(
            agent_id="finance-agent-04",
            allowed_scopes=frozenset({"invoices:read", "payments:write"}),
            financial_limit=5_000.0,
        ),
    )
    graph.add_delegation(
        "finance-agent-04",
        DelegationNode(
            agent_id="finance-agent-sub",
            allowed_scopes=frozenset({"invoices:read"}),
            financial_limit=1_000.0,
        ),
    )

    sim = BlastRadiusSimulator()
    sim.register_exposure(
        ExposureEdge("stripe_create_transfer", "invoice_1024", "invoice", "WRITE", 0.85)
    )
    sim.register_exposure(ExposureEdge("read_invoice", "invoice_1024", "invoice", "READ", 0.4))

    ctx = AccountabilityContext(
        db_connector=db,
        ledger_connector=ledger,
        delegation_graph=graph,
        blast_radius_simulator=sim,
    )
    ctx.register_passport(
        AgentPassportRecord(
            passport_id="pas_live_parent01",
            identity="finance-agent-04",
            owner="Finance Department",
            allowed_scopes=["invoices:read", "payments:write"],
            financial_limit=5000.0,
            delegation_depth=1,
        )
    )
    ctx.register_passport(
        AgentPassportRecord(
            passport_id="pas_live_subagent",
            identity="finance-agent-sub",
            owner="Finance Department",
            allowed_scopes=["payments:write"],
            financial_limit=500.0,
            delegation_depth=2,
        )
    )
    return ctx


app = create_accountability_app(_build_demo_context())
