"""Blast Radius Simulator — permission matrix and what-if tool removal analysis."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any

Permission = str  # "READ" | "WRITE" | "NONE"


class BlastLevel(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


@dataclass
class ResourceAccess:
    resource_id: str
    resource_type: str
    sensitivity: float = 0.5  # 0–1
    permissions: dict[str, Permission] = field(default_factory=dict)  # tool -> READ/WRITE


@dataclass
class BlastRadiusReport:
    score: float
    level: BlastLevel
    tool_count: int
    write_surfaces: int
    read_surfaces: int
    high_sensitivity_writes: int
    matrix: dict[str, dict[str, Permission]]
    narrative: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "score": self.score,
            "level": self.level.value,
            "tool_count": self.tool_count,
            "write_surfaces": self.write_surfaces,
            "read_surfaces": self.read_surfaces,
            "high_sensitivity_writes": self.high_sensitivity_writes,
            "matrix": self.matrix,
            "narrative": self.narrative,
        }


def _level_for_score(score: float) -> BlastLevel:
    if score >= 70:
        return BlastLevel.HIGH
    if score >= 35:
        return BlastLevel.MEDIUM
    return BlastLevel.LOW


def _build_matrix(tools: list[str], resources: list[ResourceAccess]) -> dict[str, dict[str, Permission]]:
    matrix: dict[str, dict[str, Permission]] = {}
    for tool in tools:
        row: dict[str, Permission] = {}
        for res in resources:
            row[res.resource_id] = res.permissions.get(tool, "NONE")
        matrix[tool] = row
    return matrix


def compute_blast_radius(tools: list[str], resources: list[ResourceAccess]) -> BlastRadiusReport:
    if not tools:
        return BlastRadiusReport(
            score=0.0,
            level=BlastLevel.LOW,
            tool_count=0,
            write_surfaces=0,
            read_surfaces=0,
            high_sensitivity_writes=0,
            matrix={},
            narrative="No tools configured — minimal blast radius.",
        )

    matrix = _build_matrix(tools, resources)
    write_surfaces = 0
    read_surfaces = 0
    high_sensitivity_writes = 0
    weighted = 0.0

    for tool in tools:
        for res in resources:
            perm = res.permissions.get(tool, "NONE")
            if perm == "WRITE":
                write_surfaces += 1
                weighted += 25.0 * (0.5 + res.sensitivity)
                if res.sensitivity >= 0.7:
                    high_sensitivity_writes += 1
            elif perm == "READ":
                read_surfaces += 1
                weighted += 8.0 * (0.5 + res.sensitivity)

    tool_factor = min(30.0, len(tools) * 5.0)
    score = round(min(100.0, weighted / max(1, len(tools)) + tool_factor), 2)
    level = _level_for_score(score)
    narrative = (
        f"Blast radius {level.value} ({score}/100): {write_surfaces} write and {read_surfaces} read "
        f"surfaces across {len(tools)} tools and {len(resources)} resources."
    )
    return BlastRadiusReport(
        score=score,
        level=level,
        tool_count=len(tools),
        write_surfaces=write_surfaces,
        read_surfaces=read_surfaces,
        high_sensitivity_writes=high_sensitivity_writes,
        matrix=matrix,
        narrative=narrative,
    )


def what_if_remove_tool(
    tools: list[str],
    resources: list[ResourceAccess],
    tool_to_remove: str,
) -> dict[str, Any]:
    """Compare blast radius before and after removing a tool."""
    baseline = compute_blast_radius(tools, resources)
    if tool_to_remove not in tools:
        raise ValueError(f"tool not in agent inventory: {tool_to_remove}")
    reduced_tools = [t for t in tools if t != tool_to_remove]
    after = compute_blast_radius(reduced_tools, resources)
    delta = round(baseline.score - after.score, 2)
    return {
        "tool_removed": tool_to_remove,
        "before": baseline.to_dict(),
        "after": after.to_dict(),
        "score_delta": delta,
        "level_change": f"{baseline.level.value} -> {after.level.value}",
        "recommendation": (
            f"Removing '{tool_to_remove}' reduces blast radius by {delta} points."
            if delta > 0
            else f"Removing '{tool_to_remove}' does not materially reduce blast radius."
        ),
    }


def default_demo_resources() -> list[ResourceAccess]:
    """Reference resources for docs and tests."""
    return [
        ResourceAccess(
            resource_id="customer_db",
            resource_type="database",
            sensitivity=0.9,
            permissions={
                "read_customer": "READ",
                "export_customer_database": "WRITE",
                "post_payment": "WRITE",
            },
        ),
        ResourceAccess(
            resource_id="refund_api",
            resource_type="api",
            sensitivity=0.75,
            permissions={"issue_refund": "WRITE", "read_invoice": "READ"},
        ),
        ResourceAccess(
            resource_id="payment_api",
            resource_type="api",
            sensitivity=0.85,
            permissions={"post_payment": "WRITE", "read_invoice": "READ"},
        ),
    ]
