"""Pydantic schemas for Enterprise AI Agent Governance & Trust."""

from __future__ import annotations

from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class VerificationState(str, Enum):
    VERIFIED = "VERIFIED"
    UNVERIFIED = "UNVERIFIED"


class ModuleStatus(BaseModel):
    status: VerificationState
    active: bool = True
    message: str | None = None


class AgentIdentity(BaseModel):
    agent_id: str
    owner_dept: str
    purpose: str
    registered: bool = True
    token_valid: bool = True


class EffectiveAuthoritySnapshot(BaseModel):
    agent_id: str
    evaluated_risk_level: str
    risk_flags: list[str] = Field(default_factory=list)
    requires_strict_monitoring: bool = False


class IntentContext(BaseModel):
    declared_intent: str
    tool_name: str
    alignment_score: float = Field(ge=0.0, le=1.0)
    divergent: bool = False


class TrajectoryFrame(BaseModel):
    session_id: str
    agent_id: str
    tool_name: str
    sequence_index: int
    drift_detected: bool = False
    unsafe_sequence: list[str] = Field(default_factory=list)


class DynamicTrustScore(BaseModel):
    agent_id: str
    score: float = Field(ge=0.0, le=100.0)
    tier: str
    degraded: bool = False
    restrictions: list[str] = Field(default_factory=list)


class EvidencePackage(BaseModel):
    evidence_id: str
    payload_hash: str
    decision: str
    status: str
    timestamp_utc: str
    session_id: str | None = None
    agent_id: str | None = None
    tool_name: str | None = None
    reason: str | None = None


class GovernanceStatusResponse(BaseModel):
    timestamp: str
    modules: dict[str, ModuleStatus]


class GovernanceEvaluationResult(BaseModel):
    decision: str
    trust_score: float
    modules: dict[str, ModuleStatus]
    block_reason: str | None = None
    authority: EffectiveAuthoritySnapshot | None = None
    intent: IntentContext | None = None
    trajectory: TrajectoryFrame | None = None
    trust: DynamicTrustScore | None = None
    evidence: EvidencePackage | dict[str, Any] | None = None
    degradation: dict[str, Any] | None = None
    reputation: dict[str, Any] | None = None
    trust_network: dict[str, Any] | None = None
