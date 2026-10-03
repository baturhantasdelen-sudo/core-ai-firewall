"""Agent supply chain security — dependencies, skills, and MCP integration risk."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class RiskSeverity(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


@dataclass
class SupplyChainFinding:
    code: str
    severity: RiskSeverity
    message: str
    component: str
    component_type: str  # dependency | skill | mcp_server

    def to_dict(self) -> dict[str, Any]:
        return {
            "code": self.code,
            "severity": self.severity.value,
            "message": self.message,
            "component": self.component,
            "component_type": self.component_type,
        }


@dataclass
class SupplyChainReport:
    agent_id: str
    findings: list[SupplyChainFinding] = field(default_factory=list)
    risk_score: float = 0.0

    @property
    def max_severity(self) -> RiskSeverity:
        order = [RiskSeverity.LOW, RiskSeverity.MEDIUM, RiskSeverity.HIGH, RiskSeverity.CRITICAL]
        if not self.findings:
            return RiskSeverity.LOW
        return max(self.findings, key=lambda f: order.index(f.severity)).severity

    def to_dict(self) -> dict[str, Any]:
        return {
            "agent_id": self.agent_id,
            "risk_score": self.risk_score,
            "max_severity": self.max_severity.value,
            "findings": [f.to_dict() for f in self.findings],
        }


_UNTRUSTED_VENDOR_MARKERS = ("unknown", "community", "unverified", "anonymous")
_HIGH_RISK_PERMISSIONS = frozenset(
    {"shell_exec", "file_write", "network_egress", "credential_read", "admin", "drop_database"}
)


def _score_findings(findings: list[SupplyChainFinding]) -> float:
    weights = {
        RiskSeverity.LOW: 5,
        RiskSeverity.MEDIUM: 15,
        RiskSeverity.HIGH: 30,
        RiskSeverity.CRITICAL: 50,
    }
    return round(min(100.0, sum(weights[f.severity] for f in findings)), 2)


def scan_agent_supply_chain(manifest: dict[str, Any]) -> SupplyChainReport:
    """
    Inspect agent manifest:

    - ``dependencies``: list of {name, version, source?}
    - ``skills``: list of {name, permissions: [...]}
    - ``mcp_servers``: list of {name, vendor, signed, permissions: [...], url?}
    - ``allowed_tools``: optional approved tool allowlist for inheritance checks
    """
    agent_id = str(manifest.get("agent_id") or "unknown")
    findings: list[SupplyChainFinding] = []
    allowed_tools = frozenset(str(t) for t in (manifest.get("allowed_tools") or []))

    for dep in manifest.get("dependencies") or []:
        if not isinstance(dep, dict):
            continue
        name = str(dep.get("name") or "unknown")
        source = str(dep.get("source") or "").lower()
        if source in _UNTRUSTED_VENDOR_MARKERS or "http://" in source:
            findings.append(
                SupplyChainFinding(
                    code="UNTRUSTED_DEPENDENCY",
                    severity=RiskSeverity.MEDIUM,
                    message=f"Dependency {name} from untrusted or insecure source",
                    component=name,
                    component_type="dependency",
                )
            )

    for skill in manifest.get("skills") or []:
        if not isinstance(skill, dict):
            continue
        name = str(skill.get("name") or "unknown")
        perms = skill.get("permissions") or []
        if not isinstance(perms, list):
            continue
        inherited = [p for p in perms if str(p) in _HIGH_RISK_PERMISSIONS]
        if inherited:
            findings.append(
                SupplyChainFinding(
                    code="HIGH_RISK_SKILL_PERMISSION",
                    severity=RiskSeverity.HIGH,
                    message=f"Skill {name} requests high-risk permissions: {inherited}",
                    component=name,
                    component_type="skill",
                )
            )
        if allowed_tools and name not in allowed_tools:
            findings.append(
                SupplyChainFinding(
                    code="SKILL_NOT_IN_ALLOWLIST",
                    severity=RiskSeverity.MEDIUM,
                    message=f"Skill {name} not in agent allowed_tools allowlist",
                    component=name,
                    component_type="skill",
                )
            )

    for mcp in manifest.get("mcp_servers") or []:
        if not isinstance(mcp, dict):
            continue
        name = str(mcp.get("name") or "unknown")
        vendor = str(mcp.get("vendor") or "unknown").lower()
        signed = bool(mcp.get("signed", False))
        perms = mcp.get("permissions") or []
        if not signed:
            findings.append(
                SupplyChainFinding(
                    code="UNSIGNED_MCP_SERVER",
                    severity=RiskSeverity.HIGH,
                    message=f"MCP server {name} is not signed/attested",
                    component=name,
                    component_type="mcp_server",
                )
            )
        if any(v in vendor for v in _UNTRUSTED_VENDOR_MARKERS):
            findings.append(
                SupplyChainFinding(
                    code="UNTRUSTED_MCP_VENDOR",
                    severity=RiskSeverity.CRITICAL,
                    message=f"MCP server {name} vendor {vendor} is untrusted",
                    component=name,
                    component_type="mcp_server",
                )
            )
        if isinstance(perms, list):
            extra = [str(p) for p in perms if str(p) in _HIGH_RISK_PERMISSIONS]
            if extra and allowed_tools:
                unauthorized = [p for p in extra if p not in allowed_tools]
                if unauthorized:
                    findings.append(
                        SupplyChainFinding(
                            code="MCP_INHERITED_PERMISSION_OVERFLOW",
                            severity=RiskSeverity.HIGH,
                            message=f"MCP {name} inherits unauthorized permissions: {unauthorized}",
                            component=name,
                            component_type="mcp_server",
                        )
                    )

    report = SupplyChainReport(agent_id=agent_id, findings=findings)
    report.risk_score = _score_findings(findings)
    return report
