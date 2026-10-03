"""Cross-agent delegation governance — authority chain tracking and bounds enforcement."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


class DelegationError(ValueError):
    """Invalid delegation chain or out-of-scope action."""


@dataclass(frozen=True)
class RootAuthority:
    """Top-level authority ceiling for an organization or workflow."""

    authority_id: str
    allowed_tools: frozenset[str]
    allowed_systems: frozenset[str]
    max_financial_authority: float

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> RootAuthority:
        return cls(
            authority_id=str(data["authority_id"]),
            allowed_tools=frozenset(str(t) for t in (data.get("allowed_tools") or [])),
            allowed_systems=frozenset(str(s) for s in (data.get("allowed_systems") or [])),
            max_financial_authority=float(data.get("max_financial_authority", 0.0)),
        )


@dataclass(frozen=True)
class DelegationHop:
    """Single hop: delegator grants subset of scope to delegatee."""

    from_agent: str
    to_agent: str
    allowed_tools: frozenset[str]
    allowed_systems: frozenset[str]
    max_financial_authority: float

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> DelegationHop:
        return cls(
            from_agent=str(data["from_agent"]),
            to_agent=str(data["to_agent"]),
            allowed_tools=frozenset(str(t) for t in (data.get("allowed_tools") or [])),
            allowed_systems=frozenset(str(s) for s in (data.get("allowed_systems") or [])),
            max_financial_authority=float(data.get("max_financial_authority", 0.0)),
        )


@dataclass
class DelegationChain:
    """
    Tracks Root Authority -> Agent A -> Agent B -> ... -> Tool/API execution.

    Each hop must be a subset of its parent scope; downstream agents cannot exceed
    root or upstream delegation limits.
    """

    root: RootAuthority
    hops: list[DelegationHop] = field(default_factory=list)
    _effective_scope: dict[str, dict[str, Any]] = field(default_factory=dict, repr=False)

    def __post_init__(self) -> None:
        self._rebuild_scopes()

    def _rebuild_scopes(self) -> None:
        self._effective_scope = {
            self.root.authority_id: {
                "allowed_tools": set(self.root.allowed_tools),
                "allowed_systems": set(self.root.allowed_systems),
                "max_financial_authority": self.root.max_financial_authority,
            }
        }
        for hop in self.hops:
            parent = self._effective_scope.get(hop.from_agent)
            if parent is None:
                raise DelegationError(f"delegation hop references unknown parent: {hop.from_agent}")
            if not hop.allowed_tools.issubset(parent["allowed_tools"]):
                raise DelegationError(
                    f"hop {hop.from_agent}->{hop.to_agent} expands tools beyond parent scope"
                )
            if not hop.allowed_systems.issubset(parent["allowed_systems"]):
                raise DelegationError(
                    f"hop {hop.from_agent}->{hop.to_agent} expands systems beyond parent scope"
                )
            if hop.max_financial_authority > parent["max_financial_authority"]:
                raise DelegationError(
                    f"hop {hop.from_agent}->{hop.to_agent} exceeds parent financial authority"
                )
            self._effective_scope[hop.to_agent] = {
                "allowed_tools": set(hop.allowed_tools),
                "allowed_systems": set(hop.allowed_systems),
                "max_financial_authority": hop.max_financial_authority,
            }

    def add_hop(self, hop: DelegationHop) -> None:
        self.hops.append(hop)
        self._rebuild_scopes()

    def chain_path(self) -> list[str]:
        path = [self.root.authority_id]
        for hop in self.hops:
            path.append(hop.to_agent)
        return path

    def validate_action(self, acting_agent: str, requested_action: dict[str, Any]) -> dict[str, Any]:
        """
        Ensure ``acting_agent`` may execute ``requested_action`` within delegated scope
        and root authority limits.
        """
        if acting_agent not in self._effective_scope:
            return {
                "allowed": False,
                "reason": f"agent {acting_agent} not in delegation chain",
                "chain": self.chain_path(),
            }

        scope = self._effective_scope[acting_agent]
        tool = requested_action.get("tool")
        system = requested_action.get("system")
        params = requested_action.get("params") or {}

        if not tool or not isinstance(tool, str):
            raise DelegationError("requested_action.tool is required")

        if tool not in scope["allowed_tools"]:
            return {
                "allowed": False,
                "reason": f"tool {tool} not in delegated scope for {acting_agent}",
                "chain": self.chain_path(),
            }

        if system is not None and str(system) not in scope["allowed_systems"]:
            return {
                "allowed": False,
                "reason": f"system {system} not in delegated scope for {acting_agent}",
                "chain": self.chain_path(),
            }

        amount = params.get("amount")
        if amount is not None:
            try:
                value = float(amount)
            except (TypeError, ValueError) as exc:
                raise DelegationError("params.amount must be numeric") from exc
            if value > scope["max_financial_authority"]:
                return {
                    "allowed": False,
                    "reason": f"amount {value} exceeds delegated financial limit",
                    "chain": self.chain_path(),
                }

        root_scope = self._effective_scope[self.root.authority_id]
        if tool not in root_scope["allowed_tools"]:
            return {
                "allowed": False,
                "reason": f"tool {tool} exceeds root authority",
                "chain": self.chain_path(),
            }

        return {
            "allowed": True,
            "acting_agent": acting_agent,
            "tool": tool,
            "chain": self.chain_path(),
            "effective_max_financial": scope["max_financial_authority"],
        }
