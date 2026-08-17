from __future__ import annotations

from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class RiskLevel(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


_RISK_ORDER: dict[RiskLevel, int] = {
    RiskLevel.LOW: 0,
    RiskLevel.MEDIUM: 1,
    RiskLevel.HIGH: 2,
    RiskLevel.CRITICAL: 3,
}


class AgentProfile(BaseModel):
    agent_id: str
    owner_dept: str
    purpose: str
    risk_level: RiskLevel = RiskLevel.LOW
    allowed_tools: list[str] = Field(default_factory=list)
    effective_permissions: list[str] = Field(default_factory=list)
    dynamic_trust_score: float = Field(default=100.0, ge=0.0, le=100.0)


class EffectiveAuthorityEngine:
    """Ajan yetkilerinin tekil değil, birleşik kombinasyon risklerini analiz eder."""

    @staticmethod
    def _raise_risk(current: RiskLevel, candidate: RiskLevel) -> RiskLevel:
        if _RISK_ORDER[candidate] > _RISK_ORDER[current]:
            return candidate
        return current

    @staticmethod
    def analyze_authority_risk(profile: AgentProfile) -> dict[str, Any]:
        perms = set(profile.effective_permissions)
        detected_risks: list[str] = []
        max_risk = profile.risk_level

        if {"db:read", "api:external_post"}.issubset(perms):
            detected_risks.append("POTENTIAL_DATA_EXFILTRATION_RISK")
            max_risk = EffectiveAuthorityEngine._raise_risk(max_risk, RiskLevel.HIGH)

        if {"file:write", "api:external_post"}.issubset(perms):
            detected_risks.append("POTENTIAL_FILE_EXFILTRATION_RISK")
            max_risk = EffectiveAuthorityEngine._raise_risk(max_risk, RiskLevel.HIGH)

        if {"finance:execute", "db:delete"}.issubset(perms):
            detected_risks.append("CRITICAL_FINANCIAL_DESTRUCTION_RISK")
            max_risk = EffectiveAuthorityEngine._raise_risk(max_risk, RiskLevel.CRITICAL)

        return {
            "agent_id": profile.agent_id,
            "evaluated_risk_level": max_risk,
            "risk_flags": detected_risks,
            "requires_strict_monitoring": len(detected_risks) > 0,
        }
