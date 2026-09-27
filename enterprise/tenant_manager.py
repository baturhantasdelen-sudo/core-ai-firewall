"""
Multi-tenant isolation, tenant policy overrides, and RBAC for enterprise deployments.

Roles:
  - Admin: full tenant administration
  - SecurityEngineer: policy overrides + runtime evaluation + SIEM export
  - Auditor: read-only access to evaluations, receipts, and audit metadata

Usage:
    python -m enterprise.tenant_manager --demo
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Any, Literal

logger = logging.getLogger("nexus.enterprise.tenant")

AdaptiveDecision = Literal["ALLOW", "BLOCK", "READ_ONLY", "REQUIRE_APPROVAL"]


class Role(str, Enum):
    ADMIN = "Admin"
    SECURITY_ENGINEER = "SecurityEngineer"
    AUDITOR = "Auditor"


class Permission(str, Enum):
    MANAGE_TENANTS = "manage_tenants"
    MANAGE_USERS = "manage_users"
    MANAGE_POLICY = "manage_policy"
    EVALUATE_ACTIONS = "evaluate_actions"
    EXPORT_SIEM = "export_siem"
    VIEW_AUDIT = "view_audit"
    VIEW_RECEIPTS = "view_receipts"


ROLE_PERMISSIONS: dict[Role, frozenset[Permission]] = {
    Role.ADMIN: frozenset(Permission),
    Role.SECURITY_ENGINEER: frozenset(
        {
            Permission.MANAGE_POLICY,
            Permission.EVALUATE_ACTIONS,
            Permission.EXPORT_SIEM,
            Permission.VIEW_AUDIT,
            Permission.VIEW_RECEIPTS,
        }
    ),
    Role.AUDITOR: frozenset(
        {
            Permission.VIEW_AUDIT,
            Permission.VIEW_RECEIPTS,
        }
    ),
}


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


@dataclass
class TenantPolicyOverrides:
    """Tenant-specific policy deltas applied after the global policy engine."""

    additional_high_risk_tools: frozenset[str] = field(default_factory=frozenset)
    blocked_tools: frozenset[str] = field(default_factory=frozenset)
    require_approval_tools: frozenset[str] = field(default_factory=frozenset)
    block_risk_threshold: int | None = None  # default: inherit engine (85)
    allow_read_only_fallback: bool = True
    notes: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "additional_high_risk_tools": sorted(self.additional_high_risk_tools),
            "blocked_tools": sorted(self.blocked_tools),
            "require_approval_tools": sorted(self.require_approval_tools),
            "block_risk_threshold": self.block_risk_threshold,
            "allow_read_only_fallback": self.allow_read_only_fallback,
            "notes": self.notes,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> TenantPolicyOverrides:
        return cls(
            additional_high_risk_tools=frozenset(data.get("additional_high_risk_tools") or []),
            blocked_tools=frozenset(data.get("blocked_tools") or []),
            require_approval_tools=frozenset(data.get("require_approval_tools") or []),
            block_risk_threshold=data.get("block_risk_threshold"),
            allow_read_only_fallback=bool(data.get("allow_read_only_fallback", True)),
            notes=str(data.get("notes") or ""),
        )


@dataclass
class Tenant:
    tenant_id: str
    display_name: str
    policy_overrides: TenantPolicyOverrides = field(default_factory=TenantPolicyOverrides)
    agent_ids: frozenset[str] = field(default_factory=frozenset)
    created_at_utc: str = field(default_factory=utc_now_iso)
    status: Literal["active", "suspended"] = "active"

    def to_dict(self) -> dict[str, Any]:
        return {
            "tenant_id": self.tenant_id,
            "display_name": self.display_name,
            "policy_overrides": self.policy_overrides.to_dict(),
            "agent_ids": sorted(self.agent_ids),
            "created_at_utc": self.created_at_utc,
            "status": self.status,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Tenant:
        return cls(
            tenant_id=data["tenant_id"],
            display_name=data["display_name"],
            policy_overrides=TenantPolicyOverrides.from_dict(data.get("policy_overrides") or {}),
            agent_ids=frozenset(data.get("agent_ids") or []),
            created_at_utc=data.get("created_at_utc") or utc_now_iso(),
            status=data.get("status") or "active",
        )


@dataclass
class TenantUser:
    user_id: str
    tenant_id: str
    role: Role
    email: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "user_id": self.user_id,
            "tenant_id": self.tenant_id,
            "role": self.role.value,
            "email": self.email,
        }


class TenantIsolationError(PermissionError):
    """Cross-tenant or unknown tenant access."""


class AuthorizationError(PermissionError):
    """RBAC denial."""


def _load_policy_engine():
    root = Path(__file__).resolve().parents[1]
    sys.path.insert(0, str(root / "harness"))
    from core.policy_engine import evaluate_proposed_action  # noqa: WPS433

    return evaluate_proposed_action


def _decision_rank(decision: AdaptiveDecision) -> int:
    order = {"ALLOW": 0, "READ_ONLY": 1, "REQUIRE_APPROVAL": 2, "BLOCK": 3}
    return order.get(decision, 0)


def _max_decision(a: AdaptiveDecision, b: AdaptiveDecision) -> AdaptiveDecision:
    return a if _decision_rank(a) >= _decision_rank(b) else b


def apply_tenant_overrides(
    evaluation: dict[str, Any],
    overrides: TenantPolicyOverrides,
    *,
    tool: str,
) -> dict[str, Any]:
    """Merge tenant overrides onto a base policy engine evaluation (in-place copy)."""
    out = dict(evaluation)
    receipt = dict(out.get("receipt") or {})
    decision: AdaptiveDecision = out.get("decision", "ALLOW")
    rule_id = out.get("rule_id", "POLICY_BASELINE_ALLOW")
    risk = int(out.get("risk_score", 0))
    violations = list(out.get("violations") or [])

    if tool in overrides.blocked_tools:
        decision = "BLOCK"
        rule_id = "TENANT_POLICY_BLOCK_TOOL"
        violations.append(f"TENANT_BLOCKED_TOOL:{tool}")

    if tool in overrides.additional_high_risk_tools and "HIGH_RISK_TOOL" not in "".join(violations):
        risk = min(100, risk + 35)
        violations.append(f"TENANT_HIGH_RISK_TOOL:{tool}")

    threshold = overrides.block_risk_threshold if overrides.block_risk_threshold is not None else 85
    if risk >= threshold:
        decision = _max_decision(decision, "BLOCK")
        rule_id = "TENANT_POLICY_BLOCK_THRESHOLD" if decision == "BLOCK" else rule_id

    if tool in overrides.require_approval_tools:
        decision = _max_decision(decision, "REQUIRE_APPROVAL")
        if decision == "REQUIRE_APPROVAL":
            rule_id = "TENANT_POLICY_HITL"
        violations.append(f"TENANT_REQUIRE_APPROVAL:{tool}")

    if decision == "READ_ONLY" and not overrides.allow_read_only_fallback:
        decision = _max_decision(decision, "REQUIRE_APPROVAL")
        rule_id = "TENANT_POLICY_NO_READ_ONLY"

    out["decision"] = decision
    out["rule_id"] = rule_id
    out["risk_score"] = risk
    out["violations"] = violations
    if receipt:
        receipt["decision"] = decision
        receipt["policy_evaluated"] = {"rule_id": rule_id, "action": decision}
        out["receipt"] = receipt
    out["tenant_override_applied"] = True
    return out


@dataclass
class TenantManager:
    """
    In-memory multi-tenant registry with RBAC and isolated policy evaluation.

    Persist optionally via JSON file (enterprise/data/tenants_registry.json).
    """

    registry_path: Path = field(
        default_factory=lambda: Path("enterprise/data/tenants_registry.json"),
    )
    _tenants: dict[str, Tenant] = field(default_factory=dict, repr=False)
    _users: dict[str, TenantUser] = field(default_factory=dict, repr=False)

    def __post_init__(self) -> None:
        if self.registry_path.is_file():
            self.load()

    # --- Tenant lifecycle ---

    def create_tenant(
        self,
        display_name: str,
        *,
        tenant_id: str | None = None,
        policy_overrides: TenantPolicyOverrides | None = None,
    ) -> Tenant:
        tid = tenant_id or f"tnt_{uuid.uuid4().hex[:12]}"
        if tid in self._tenants:
            raise ValueError(f"Tenant already exists: {tid}")
        tenant = Tenant(
            tenant_id=tid,
            display_name=display_name,
            policy_overrides=policy_overrides or TenantPolicyOverrides(),
        )
        self._tenants[tid] = tenant
        logger.info("Tenant created | tenant_id=%s", tid)
        return tenant

    def get_tenant(self, tenant_id: str) -> Tenant:
        tenant = self._tenants.get(tenant_id)
        if not tenant:
            raise TenantIsolationError(f"Unknown tenant: {tenant_id}")
        return tenant

    def assert_tenant_active(self, tenant_id: str) -> Tenant:
        tenant = self.get_tenant(tenant_id)
        if tenant.status != "active":
            raise TenantIsolationError(f"Tenant suspended: {tenant_id}")
        return tenant

    def register_agent(self, tenant_id: str, agent_id: str) -> None:
        tenant = self.assert_tenant_active(tenant_id)
        if agent_id in tenant.agent_ids:
            return
        updated = Tenant(
            tenant_id=tenant.tenant_id,
            display_name=tenant.display_name,
            policy_overrides=tenant.policy_overrides,
            agent_ids=tenant.agent_ids | {agent_id},
            created_at_utc=tenant.created_at_utc,
            status=tenant.status,
        )
        self._tenants[tenant_id] = updated

    def assert_agent_belongs_to_tenant(self, tenant_id: str, agent_id: str) -> None:
        tenant = self.assert_tenant_active(tenant_id)
        if tenant.agent_ids and agent_id not in tenant.agent_ids:
            raise TenantIsolationError(
                f"Agent {agent_id!r} is not registered to tenant {tenant_id!r}",
            )

    def update_policy_overrides(self, tenant_id: str, overrides: TenantPolicyOverrides) -> Tenant:
        tenant = self.assert_tenant_active(tenant_id)
        updated = Tenant(
            tenant_id=tenant.tenant_id,
            display_name=tenant.display_name,
            policy_overrides=overrides,
            agent_ids=tenant.agent_ids,
            created_at_utc=tenant.created_at_utc,
            status=tenant.status,
        )
        self._tenants[tenant_id] = updated
        return updated

    # --- RBAC ---

    def assign_user(self, tenant_id: str, email: str, role: Role, *, user_id: str | None = None) -> TenantUser:
        self.assert_tenant_active(tenant_id)
        uid = user_id or f"usr_{uuid.uuid4().hex[:12]}"
        user = TenantUser(user_id=uid, tenant_id=tenant_id, role=role, email=email)
        self._users[uid] = user
        return user

    def get_user(self, user_id: str) -> TenantUser:
        user = self._users.get(user_id)
        if not user:
            raise AuthorizationError(f"Unknown user: {user_id}")
        return user

    def authorize(self, user_id: str, permission: Permission, *, tenant_id: str | None = None) -> None:
        user = self.get_user(user_id)
        if tenant_id is not None and user.tenant_id != tenant_id:
            raise TenantIsolationError("User belongs to a different tenant")
        allowed = ROLE_PERMISSIONS.get(user.role, frozenset())
        if permission not in allowed:
            raise AuthorizationError(
                f"Role {user.role.value} lacks permission {permission.value}",
            )

    def has_permission(self, user_id: str, permission: Permission) -> bool:
        try:
            self.authorize(user_id, permission)
            return True
        except (AuthorizationError, TenantIsolationError):
            return False

    # --- Isolated evaluation ---

    def evaluate_action(
        self,
        *,
        tenant_id: str,
        actor_user_id: str,
        agent_id: str,
        intent: str,
        tool: str,
        params: dict[str, Any] | None = None,
        identity_verified: bool = True,
    ) -> dict[str, Any]:
        self.authorize(actor_user_id, Permission.EVALUATE_ACTIONS, tenant_id=tenant_id)
        tenant = self.assert_tenant_active(tenant_id)
        self.assert_agent_belongs_to_tenant(tenant_id, agent_id)

        evaluate = _load_policy_engine()
        base = evaluate(
            agent_id=agent_id,
            intent=intent,
            tool=tool,
            params=params or {},
            identity_verified=identity_verified,
        )
        merged = apply_tenant_overrides(base, tenant.policy_overrides, tool=tool)
        merged["tenant_id"] = tenant_id
        merged["evaluated_by"] = actor_user_id
        merged["evaluated_at_utc"] = utc_now_iso()
        return merged

    def view_receipt(
        self,
        *,
        tenant_id: str,
        actor_user_id: str,
        receipt: dict[str, Any],
    ) -> dict[str, Any]:
        self.authorize(actor_user_id, Permission.VIEW_RECEIPTS, tenant_id=tenant_id)
        self.assert_tenant_active(tenant_id)
        agent = (receipt.get("agent") or {}).get("id")
        if agent:
            self.assert_agent_belongs_to_tenant(tenant_id, agent)
        return {
            "tenant_id": tenant_id,
            "viewed_by": actor_user_id,
            "viewed_at_utc": utc_now_iso(),
            "receipt": receipt,
        }

    # --- Persistence ---

    def save(self) -> None:
        payload = {
            "schema_version": "1.0",
            "saved_at_utc": utc_now_iso(),
            "tenants": [t.to_dict() for t in self._tenants.values()],
            "users": [u.to_dict() for u in self._users.values()],
        }
        self.registry_path.parent.mkdir(parents=True, exist_ok=True)
        self.registry_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")

    def load(self) -> None:
        data = json.loads(self.registry_path.read_text(encoding="utf-8"))
        self._tenants = {t["tenant_id"]: Tenant.from_dict(t) for t in data.get("tenants") or []}
        self._users = {}
        for raw in data.get("users") or []:
            user = TenantUser(
                user_id=raw["user_id"],
                tenant_id=raw["tenant_id"],
                role=Role(raw["role"]),
                email=raw.get("email") or "",
            )
            self._users[user.user_id] = user


def _demo() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s | %(message)s")
    mgr = TenantManager(registry_path=Path("enterprise/data/tenants_registry.demo.json"))

    acme = mgr.create_tenant(
        "Acme FinTech",
        tenant_id="tnt_acme_fintech",
        policy_overrides=TenantPolicyOverrides(
            blocked_tools=frozenset({"merge_pull_request"}),
            require_approval_tools=frozenset({"export_customer_database"}),
            notes="Production tenant — stricter merge block",
        ),
    )
    other = mgr.create_tenant("Beta Labs", tenant_id="tnt_beta_labs")

    admin = mgr.assign_user(acme.tenant_id, "admin@acme.com", Role.ADMIN)
    engineer = mgr.assign_user(acme.tenant_id, "sec@acme.com", Role.SECURITY_ENGINEER)
    auditor = mgr.assign_user(acme.tenant_id, "audit@acme.com", Role.AUDITOR)

    mgr.register_agent(acme.tenant_id, "tnt_acme_fintech:payments-agent-01")

    evaluation = mgr.evaluate_action(
        tenant_id=acme.tenant_id,
        actor_user_id=engineer.user_id,
        agent_id="tnt_acme_fintech:payments-agent-01",
        intent="Export all invoices",
        tool="export_customer_database",
        params={"destination": "https://webhook.site/acme-test"},
        identity_verified=False,
    )

    print("\n=== Tenant evaluation (SecurityEngineer) ===")
    print(json.dumps({k: evaluation[k] for k in ("tenant_id", "decision", "rule_id", "risk_score", "violations")}, indent=2))

    receipt_view = mgr.view_receipt(
        tenant_id=acme.tenant_id,
        actor_user_id=auditor.user_id,
        receipt=evaluation["receipt"],
    )
    print("\n=== Auditor receipt view ===")
    print(json.dumps({"tenant_id": receipt_view["tenant_id"], "viewed_by": receipt_view["viewed_by"]}, indent=2))

    try:
        mgr.evaluate_action(
            tenant_id=other.tenant_id,
            actor_user_id=engineer.user_id,
            agent_id="tnt_acme_fintech:payments-agent-01",
            intent="Cross-tenant attempt",
            tool="fetch",
            params={},
        )
    except TenantIsolationError as exc:
        print(f"\n=== Expected isolation block: {exc} ===")

    try:
        mgr.authorize(auditor.user_id, Permission.MANAGE_POLICY)
    except AuthorizationError as exc:
        print(f"=== Expected RBAC block: {exc} ===")

    mgr.save()
    print(f"\nRegistry saved to {mgr.registry_path}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Nexus Shield enterprise tenant manager")
    parser.add_argument("--demo", action="store_true", help="Run multi-tenant RBAC demo")
    args = parser.parse_args()
    if args.demo:
        _demo()
        return 0
    parser.print_help()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
