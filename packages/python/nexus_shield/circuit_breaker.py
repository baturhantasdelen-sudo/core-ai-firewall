"""Agent Circuit Breaker — multi-factor risk scoring and dynamic execution gates."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class CircuitAction(str, Enum):
    ALLOW = "ALLOW"
    MONITOR = "MONITOR"
    READ_ONLY = "READ_ONLY"
    REQUIRE_APPROVAL = "REQUIRE_APPROVAL"
    REVOKE = "REVOKE"


class ExecutionMode(str, Enum):
    NORMAL = "NORMAL"
    MONITORED = "MONITORED"
    READ_ONLY = "READ_ONLY"
    APPROVAL_PENDING = "APPROVAL_PENDING"
    KILLED = "KILLED"


_MODE_RANK: dict[ExecutionMode, int] = {
    ExecutionMode.NORMAL: 0,
    ExecutionMode.MONITORED: 1,
    ExecutionMode.READ_ONLY: 2,
    ExecutionMode.APPROVAL_PENDING: 3,
    ExecutionMode.KILLED: 4,
}


@dataclass
class RiskSignals:
    """Factor inputs in range 0.0–1.0 (higher = riskier)."""

    intent_deviation: float = 0.0
    authority_deviation: float = 0.0
    data_sensitivity: float = 0.0
    destination_risk: float = 0.0
    action_criticality: float = 0.0
    trajectory_anomaly: float = 0.0

    def validate(self) -> None:
        for name, val in (
            ("intent_deviation", self.intent_deviation),
            ("authority_deviation", self.authority_deviation),
            ("data_sensitivity", self.data_sensitivity),
            ("destination_risk", self.destination_risk),
            ("action_criticality", self.action_criticality),
            ("trajectory_anomaly", self.trajectory_anomaly),
        ):
            if not 0.0 <= val <= 1.0:
                raise ValueError(f"{name} must be between 0.0 and 1.0, got {val}")


_RISK_WEIGHTS: dict[str, float] = {
    "intent_deviation": 22.0,
    "authority_deviation": 18.0,
    "data_sensitivity": 20.0,
    "destination_risk": 15.0,
    "action_criticality": 15.0,
    "trajectory_anomaly": 10.0,
}


def compute_risk_score(signals: RiskSignals) -> float:
    signals.validate()
    total = (
        signals.intent_deviation * _RISK_WEIGHTS["intent_deviation"]
        + signals.authority_deviation * _RISK_WEIGHTS["authority_deviation"]
        + signals.data_sensitivity * _RISK_WEIGHTS["data_sensitivity"]
        + signals.destination_risk * _RISK_WEIGHTS["destination_risk"]
        + signals.action_criticality * _RISK_WEIGHTS["action_criticality"]
        + signals.trajectory_anomaly * _RISK_WEIGHTS["trajectory_anomaly"]
    )
    return round(min(100.0, max(0.0, total)), 2)


def action_for_risk_score(score: float) -> CircuitAction:
    if score > 95:
        return CircuitAction.REVOKE
    if score > 80:
        return CircuitAction.REQUIRE_APPROVAL
    if score > 60:
        return CircuitAction.READ_ONLY
    if score > 30:
        return CircuitAction.MONITOR
    return CircuitAction.ALLOW


def execution_mode_for_action(action: CircuitAction) -> ExecutionMode:
    mapping = {
        CircuitAction.ALLOW: ExecutionMode.NORMAL,
        CircuitAction.MONITOR: ExecutionMode.MONITORED,
        CircuitAction.READ_ONLY: ExecutionMode.READ_ONLY,
        CircuitAction.REQUIRE_APPROVAL: ExecutionMode.APPROVAL_PENDING,
        CircuitAction.REVOKE: ExecutionMode.KILLED,
    }
    return mapping[action]


@dataclass
class CircuitBreakerState:
    agent_id: str
    mode: ExecutionMode = ExecutionMode.NORMAL
    last_risk_score: float = 0.0
    last_action: CircuitAction = CircuitAction.ALLOW
    trip_count: int = 0

    def can_execute_write(self) -> bool:
        return self.mode in (ExecutionMode.NORMAL, ExecutionMode.MONITORED)


@dataclass
class AgentCircuitBreaker:
    """Per-agent circuit breaker with state transitions."""

    _states: dict[str, CircuitBreakerState] = field(default_factory=dict)

    def evaluate(self, agent_id: str, signals: RiskSignals) -> dict[str, Any]:
        if not agent_id:
            raise ValueError("agent_id is required")
        score = compute_risk_score(signals)
        action = action_for_risk_score(score)
        proposed_mode = execution_mode_for_action(action)
        state = self._states.get(agent_id) or CircuitBreakerState(agent_id=agent_id)
        if action in (CircuitAction.REVOKE, CircuitAction.REQUIRE_APPROVAL, CircuitAction.READ_ONLY):
            state.trip_count += 1
        state.last_risk_score = score
        state.last_action = action
        state.mode = self._transition(state.mode, proposed_mode, action)
        self._states[agent_id] = state
        return {
            "agent_id": agent_id,
            "risk_score": score,
            "circuit_action": action.value,
            "execution_mode": state.mode.value,
            "trip_count": state.trip_count,
            "can_execute_write": state.can_execute_write(),
        }

    @staticmethod
    def _transition(current: ExecutionMode, proposed: ExecutionMode, action: CircuitAction) -> ExecutionMode:
        if action == CircuitAction.REVOKE:
            return ExecutionMode.KILLED
        if current == ExecutionMode.KILLED:
            return ExecutionMode.KILLED
        if _MODE_RANK[proposed] >= _MODE_RANK[current]:
            return proposed
        return current

    def get_state(self, agent_id: str) -> CircuitBreakerState | None:
        return self._states.get(agent_id)

    def reset(self, agent_id: str) -> None:
        self._states[agent_id] = CircuitBreakerState(agent_id=agent_id)
