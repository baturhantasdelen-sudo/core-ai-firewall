"""Proactive circuit breaker — revoke passports and freeze delegation subtrees."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal

from nexus_shield.core.delegation import DelegationGraph

TripReason = Literal["UNVERIFIED_OUTCOME", "POLICY_VIOLATION", "MANUAL_KILL"]


@dataclass
class CircuitBreakerState:
    revoked_passport_ids: set[str] = field(default_factory=set)
    frozen_agent_ids: set[str] = field(default_factory=set)
    trips: list[dict[str, Any]] = field(default_factory=list)


class AgentCircuitBreaker:
    """Immediate containment after false success or gateway policy violations."""

    def __init__(self, state: CircuitBreakerState | None = None) -> None:
        self._state = state or CircuitBreakerState()

    @property
    def state(self) -> CircuitBreakerState:
        return self._state

    def is_passport_revoked(self, passport_id: str) -> bool:
        return passport_id in self._state.revoked_passport_ids

    def is_agent_frozen(self, agent_id: str) -> bool:
        return agent_id in self._state.frozen_agent_ids

    def trip(
        self,
        *,
        reason: TripReason,
        passport_id: str,
        agent_id: str,
        delegation_graph: DelegationGraph | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        self._state.revoked_passport_ids.add(passport_id)
        self._state.frozen_agent_ids.add(agent_id)
        frozen_subtree: list[str] = [agent_id]
        if delegation_graph is not None:
            frozen_subtree = delegation_graph.freeze_subtree(agent_id)

        event = {
            "event": "CIRCUIT_BREAKER_TRIP",
            "reason": reason,
            "passport_id": passport_id,
            "agent_id": agent_id,
            "frozen_agents": frozen_subtree,
            "metadata": metadata or {},
        }
        self._state.trips.append(event)
        return event
