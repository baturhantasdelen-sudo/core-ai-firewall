"""Blast radius simulator — operational risk scoring and exposure mapping."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class RiskTier(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


@dataclass(frozen=True)
class ExposureEdge:
    tool: str
    resource_id: str
    resource_type: str
    permission: str  # READ | WRITE | EXECUTE | ADMIN
    sensitivity: float = 0.5  # 0.0 – 1.0


@dataclass
class OperationalRiskReport:
    score: float
    tier: RiskTier
    tool_count: int
    resource_count: int
    write_exposures: int
    admin_exposures: int
    high_sensitivity_writes: int
    exposure_map: dict[str, list[str]]
    narrative: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "score": self.score,
            "tier": self.tier.value,
            "tool_count": self.tool_count,
            "resource_count": self.resource_count,
            "write_exposures": self.write_exposures,
            "admin_exposures": self.admin_exposures,
            "high_sensitivity_writes": self.high_sensitivity_writes,
            "exposure_map": self.exposure_map,
            "narrative": self.narrative,
        }


def _tier_for_score(score: float) -> RiskTier:
    if score >= 85:
        return RiskTier.CRITICAL
    if score >= 60:
        return RiskTier.HIGH
    if score >= 30:
        return RiskTier.MEDIUM
    return RiskTier.LOW


@dataclass
class BlastRadiusSimulator:
    """
    Score how much damage a tool inventory could cause across sensitive resources.

    Uses weighted write/admin permissions and resource sensitivity.
    """

    write_weight: float = 3.0
    admin_weight: float = 5.0
    read_weight: float = 1.0
    execute_weight: float = 2.5
    _edges: list[ExposureEdge] = field(default_factory=list)

    def register_exposure(self, edge: ExposureEdge) -> None:
        if edge.sensitivity < 0.0 or edge.sensitivity > 1.0:
            raise ValueError("sensitivity must be between 0.0 and 1.0")
        perm = edge.permission.upper()
        if perm not in {"READ", "WRITE", "EXECUTE", "ADMIN"}:
            raise ValueError(f"unsupported permission: {edge.permission}")
        self._edges.append(
            ExposureEdge(
                tool=edge.tool,
                resource_id=edge.resource_id,
                resource_type=edge.resource_type,
                permission=perm,
                sensitivity=edge.sensitivity,
            )
        )

    def simulate(self) -> OperationalRiskReport:
        if not self._edges:
            return OperationalRiskReport(
                score=0.0,
                tier=RiskTier.LOW,
                tool_count=0,
                resource_count=0,
                write_exposures=0,
                admin_exposures=0,
                high_sensitivity_writes=0,
                exposure_map={},
                narrative="No tool-to-resource exposures registered.",
            )

        tools = sorted({e.tool for e in self._edges})
        resources = sorted({e.resource_id for e in self._edges})
        exposure_map: dict[str, list[str]] = {t: [] for t in tools}

        raw_score = 0.0
        write_exposures = 0
        admin_exposures = 0
        high_sensitivity_writes = 0

        perm_weight = {
            "READ": self.read_weight,
            "WRITE": self.write_weight,
            "EXECUTE": self.execute_weight,
            "ADMIN": self.admin_weight,
        }

        for edge in self._edges:
            weight = perm_weight[edge.permission]
            contribution = weight * (10.0 + edge.sensitivity * 90.0)
            raw_score += contribution
            exposure_map.setdefault(edge.tool, [])
            if edge.resource_id not in exposure_map[edge.tool]:
                exposure_map[edge.tool].append(edge.resource_id)
            if edge.permission == "WRITE":
                write_exposures += 1
                if edge.sensitivity >= 0.7:
                    high_sensitivity_writes += 1
            if edge.permission == "ADMIN":
                admin_exposures += 1

        max_theoretical = len(self._edges) * self.admin_weight * 100.0
        score = min(100.0, round((raw_score / max_theoretical) * 100.0, 2)) if max_theoretical else 0.0
        tier = _tier_for_score(score)

        narrative = (
            f"{len(tools)} tool(s) touch {len(resources)} resource(s); "
            f"{write_exposures} write and {admin_exposures} admin exposure(s); "
            f"operational risk tier {tier.value} (score {score})."
        )

        return OperationalRiskReport(
            score=score,
            tier=tier,
            tool_count=len(tools),
            resource_count=len(resources),
            write_exposures=write_exposures,
            admin_exposures=admin_exposures,
            high_sensitivity_writes=high_sensitivity_writes,
            exposure_map=exposure_map,
            narrative=narrative,
        )

    def what_if_remove_tool(self, tool: str) -> OperationalRiskReport:
        clone = BlastRadiusSimulator(
            write_weight=self.write_weight,
            admin_weight=self.admin_weight,
            read_weight=self.read_weight,
            execute_weight=self.execute_weight,
        )
        for edge in self._edges:
            if edge.tool != tool:
                clone.register_exposure(edge)
        return clone.simulate()
