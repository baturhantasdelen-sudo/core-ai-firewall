"""Delegation graph — multi-agent authority with zero privilege escalation."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


class DelegationGraphError(ValueError):
    """Invalid delegation edge or unknown agent in graph."""


@dataclass(frozen=True)
class DelegationNode:
    agent_id: str
    allowed_scopes: frozenset[str]
    financial_limit: float


def _scope_subset(child: frozenset[str], parent: frozenset[str]) -> bool:
    for scope in child:
        if scope in parent:
            continue
        covered = any(
            p.endswith(":*") and (scope.startswith(p[:-1]) or scope.split(":")[0] == p[:-2])
            for p in parent
        )
        if not covered:
            return False
    return True


@dataclass
class DelegationGraph:
    """
    Directed delegation tree from a root authority.

    Each edge may only narrow scopes and financial limits — never expand them.
    """

    root: DelegationNode
    _nodes: dict[str, DelegationNode] | None = None
    _parent: dict[str, str] | None = None
    _frozen: set[str] | None = None

    def __post_init__(self) -> None:
        self._nodes = {self.root.agent_id: self.root}
        self._parent = {}
        self._frozen = set()

    def add_delegation(self, delegator: str, delegatee: DelegationNode) -> None:
        assert self._nodes is not None and self._parent is not None
        if delegator not in self._nodes:
            raise DelegationGraphError(f"delegator {delegator!r} is not in the graph")
        if delegatee.agent_id in self._nodes:
            raise DelegationGraphError(f"agent {delegatee.agent_id!r} already registered")
        if delegator == delegatee.agent_id:
            raise DelegationGraphError("self-delegation is not allowed")

        parent = self._nodes[delegator]
        if not _scope_subset(delegatee.allowed_scopes, parent.allowed_scopes):
            raise DelegationGraphError(
                f"delegation {delegator}->{delegatee.agent_id} expands scopes beyond parent"
            )
        if delegatee.financial_limit > parent.financial_limit:
            raise DelegationGraphError(
                f"delegation {delegator}->{delegatee.agent_id} exceeds parent financial limit"
            )

        self._nodes[delegatee.agent_id] = delegatee
        self._parent[delegatee.agent_id] = delegator

    def depth(self, agent_id: str) -> int:
        assert self._parent is not None
        if agent_id not in self._nodes:
            raise DelegationGraphError(f"agent {agent_id} not in delegation graph")
        depth = 0
        current = agent_id
        while current in self._parent:
            depth += 1
            current = self._parent[current]
        return depth

    def verify_chain(self, agent_id: str) -> bool:
        try:
            self.depth(agent_id)
        except DelegationGraphError:
            return False
        return agent_id in (self._nodes or {})

    def effective_node(self, agent_id: str) -> DelegationNode:
        assert self._nodes is not None
        if agent_id not in self._nodes:
            raise DelegationGraphError(f"agent {agent_id} not in delegation graph")
        return self._nodes[agent_id]

    def descendants(self, agent_id: str) -> list[str]:
        assert self._parent is not None
        children: list[str] = []
        for delegatee, delegator in self._parent.items():
            if delegator == agent_id:
                children.append(delegatee)
                children.extend(self.descendants(delegatee))
        return children

    def freeze_subtree(self, agent_id: str) -> list[str]:
        assert self._frozen is not None
        frozen = [agent_id, *self.descendants(agent_id)]
        self._frozen.update(frozen)
        return frozen

    def is_frozen(self, agent_id: str) -> bool:
        assert self._frozen is not None
        return agent_id in self._frozen

    def validate_action(
        self,
        agent_id: str,
        *,
        required_scopes: list[str],
        amount: float | None = None,
    ) -> dict[str, Any]:
        if self.is_frozen(agent_id):
            return {
                "allowed": False,
                "reason": f"agent {agent_id} frozen by circuit breaker",
                "depth": self.depth(agent_id) if agent_id in (self._nodes or {}) else 0,
            }
        node = self.effective_node(agent_id)
        for required in required_scopes:
            if not any(
                required == s or (s.endswith(":*") and required.startswith(s[:-1]))
                for s in node.allowed_scopes
            ):
                return {
                    "allowed": False,
                    "reason": f"scope {required} not in effective delegation for {agent_id}",
                    "depth": self.depth(agent_id),
                }
        if amount is not None and amount > node.financial_limit:
            return {
                "allowed": False,
                "reason": f"amount exceeds delegated financial limit for {agent_id}",
                "depth": self.depth(agent_id),
            }
        return {
            "allowed": True,
            "agent_id": agent_id,
            "depth": self.depth(agent_id),
            "verified_by_graph": self.verify_chain(agent_id),
        }
