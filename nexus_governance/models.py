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
    intent_mismatch: bool = False
    risk_flags: list[str] = Field(default_factory=list)
    intent_analysis: dict[str, Any] | None = None


class TrajectoryAction(BaseModel):
    index: int
    tool_name: str
    agent_id: str
    timestamp_utc: str


class TrajectoryFrame(BaseModel):
    session_id: str
    agent_id: str
    tool_name: str
    sequence_index: int
    drift_detected: bool = False
    unsafe_sequence: list[str] = Field(default_factory=list)
    trajectory: list[TrajectoryAction] = Field(default_factory=list)
    evaluated_risk_level: str = "LOW"
    risk_flags: list[str] = Field(default_factory=list)
    requires_human_approval: bool = False


class PolicyDecision(BaseModel):
    decision: str
    reason: str | None = None
    evaluated_risk_level: str = "LOW"
    risk_flags: list[str] = Field(default_factory=list)


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


class AuditTrailEntry(BaseModel):
    timestamp: str
    session_id: str
    agent_id: str
    tool_name: str
    decision: str
    evaluated_risk_level: str = "LOW"
    risk_flags: list[str] = Field(default_factory=list)
    evidence_id: str | None = None
    payload_hash: str | None = None
    evidence_status: str | None = None
    entry_hash: str | None = None
    reason: str | None = None
    approval_id: str | None = None
    policy: dict[str, Any] | None = None


class AuditTrailResponse(BaseModel):
    timestamp: str
    entries: list[AuditTrailEntry]
    total: int
    redis_connected: bool = False


class ProofCenterLatencyMetrics(BaseModel):
    avg_ms: float
    p95_ms: float
    certified_sub_10ms: bool = False


class ProofCenterAttackBenchmark(BaseModel):
    blocked: int
    total: int
    accuracy_pct: float


class ProofCenterIntentDivergence(BaseModel):
    accuracy_pct: float


class ProofCenterMetricsResponse(BaseModel):
    source: str = "default"
    timestamp_utc: str | None = None
    base_url: str | None = None
    json_path: str | None = None
    latency: ProofCenterLatencyMetrics
    attack_benchmark: ProofCenterAttackBenchmark
    intent_divergence: ProofCenterIntentDivergence
    false_positive_rate: float = 0.0


class ProofCenterRunResponse(BaseModel):
    status: str
    message: str
    metrics: ProofCenterMetricsResponse


class GovernanceEvaluationResult(BaseModel):
    decision: str
    trust_score: float
    modules: dict[str, ModuleStatus]
    block_reason: str | None = None
    policy: PolicyDecision | None = None
    requires_human_approval: bool = False
    approval_id: str | None = None
    authority: EffectiveAuthoritySnapshot | None = None
    intent: IntentContext | None = None
    trajectory: TrajectoryFrame | None = None
    trust: DynamicTrustScore | None = None
    evidence: EvidencePackage | dict[str, Any] | None = None
    degradation: dict[str, Any] | None = None
    reputation: dict[str, Any] | None = None
    trust_network: dict[str, Any] | None = None
