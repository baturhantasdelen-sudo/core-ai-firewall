"""OpenAPI-documented request/response schemas for agent governance endpoints."""

from __future__ import annotations

from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class RiskLevel(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class RiskFlag(str, Enum):
    INTENT_MISMATCH = "INTENT_MISMATCH"
    POTENTIAL_DATA_EXFILTRATION_RISK = "POTENTIAL_DATA_EXFILTRATION_RISK"
    TRAJECTORY_VIOLATION = "TRAJECTORY_VIOLATION"
    TRAJECTORY_EXFILTRATION_SEQUENCE = "TRAJECTORY_EXFILTRATION_SEQUENCE"
    UNSAFE_TOOL_SEQUENCE = "UNSAFE_TOOL_SEQUENCE"


class ActionDecision(str, Enum):
    ALLOW = "ALLOW"
    BLOCK = "BLOCK"
    REQUIRES_HUMAN_APPROVAL = "REQUIRES_HUMAN_APPROVAL"
    DEGRADE_READ_ONLY = "DEGRADE_READ_ONLY"


class ActionStatus(str, Enum):
    APPROVED = "APPROVED"
    PENDING_APPROVAL = "PENDING_APPROVAL"
    REJECTED = "REJECTED"
    EXECUTED = "EXECUTED"
    DEGRADED = "DEGRADED"
    BLOCKED = "BLOCKED"


class AgentActionRequest(BaseModel):
    tool_name: str = Field(
        ...,
        description="Function or tool the agent wants to execute (e.g. read_invoice, send_email)",
        examples=["read_invoice"],
    )
    arguments: dict[str, Any] = Field(
        default_factory=dict,
        description="Parameters passed to the tool",
        examples=[{"invoice_id": "INV-2026-001"}],
    )
    user_prompt: str | None = Field(
        default=None,
        description="Original user input for Intent Engine semantic alignment",
        examples=["Bugün İstanbul'da hava kaç derece?"],
    )
    tool_purpose: str | None = Field(
        default="",
        description="Agent-declared rationale for invoking this tool",
        examples=["Finansal fatura detaylarını veritabanından okur."],
    )
    user_intent: str = Field(
        default="Process finance workflow",
        description="Fallback intent text when user_prompt is omitted",
    )
    divergence_score: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
        description="Optional firewall divergence score supplied by the caller",
    )


class AuthorityAnalysis(BaseModel):
    model_config = ConfigDict(extra="allow")

    agent_id: str = Field(..., examples=["agent-finance-01"])
    evaluated_risk_level: RiskLevel = Field(..., examples=[RiskLevel.HIGH])
    risk_flags: list[RiskFlag | str] = Field(
        default_factory=list,
        description=(
            "Triggered security flags "
            "(e.g. INTENT_MISMATCH, POTENTIAL_DATA_EXFILTRATION_RISK)"
        ),
        examples=[["INTENT_MISMATCH"]],
    )
    requires_strict_monitoring: bool = Field(default=True, examples=[True])


class IntentAnalysisDetails(BaseModel):
    model_config = ConfigDict(extra="allow")

    similarity_score: float = Field(
        ...,
        description="Cosine similarity score (0.0 - 1.0)",
        examples=[0.1142],
    )
    threshold: float = Field(..., description="Applied similarity threshold", examples=[0.35])
    intent_matched: bool = Field(..., examples=[False])
    flag: str | None = Field(default=None, examples=["INTENT_MISMATCH"])


class AgentActionResult(BaseModel):
    status: str = Field(..., examples=["WAITING_FOR_APPROVAL"])
    message: str = Field(
        ...,
        examples=[
            "Action suspended due to semantic intent mismatch between user prompt and requested tool."
        ],
    )


class HitlDecision(str, Enum):
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class AgentApprovalDecisionRequest(BaseModel):
    approval_id: str = Field(..., examples=["appr_55080847"])
    decision: HitlDecision = Field(..., examples=[HitlDecision.REJECTED])
    reviewer_notes: str | None = Field(
        default="",
        examples=["Güvenlik ihlali gerekçesiyle insan denetçisi tarafından reddedildi."],
    )


class AgentApprovalDecisionResponse(BaseModel):
    status: ActionStatus = Field(..., examples=[ActionStatus.REJECTED])
    decision: HitlDecision = Field(..., examples=[HitlDecision.REJECTED])
    approval_id: str = Field(..., examples=["appr_55080847"])
    agent_id: str = Field(..., examples=["agent-finance-01"])
    tool_name: str = Field(..., examples=["read_invoice"])
    payload_hash: str | None = Field(default=None)
    reviewer_notes: str | None = None
    message: str = Field(
        ...,
        examples=["Human reviewer rejected the suspended agent action."],
    )


class AgentActionResponse(BaseModel):
    """Primary governance response for POST /v1/agent/action."""

    model_config = ConfigDict(extra="allow")

    status: ActionStatus | str = Field(..., examples=[ActionStatus.PENDING_APPROVAL])
    decision: ActionDecision | str = Field(..., examples=[ActionDecision.REQUIRES_HUMAN_APPROVAL])
    requires_human_approval: bool = Field(..., examples=[True])
    approval_id: str | None = Field(
        default=None,
        description="Unique identifier for Human-in-the-Loop approval workflow",
        examples=["appr_7f3a91b2"],
    )
    payload_hash: str | None = Field(
        default=None,
        description="SHA-256 cryptographic hash of the action payload",
        examples=["e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"],
    )
    authority_analysis: AuthorityAnalysis | None = None
    intent_analysis: IntentAnalysisDetails | None = None
    result: AgentActionResult | None = None


AGENT_ACTION_OPENAPI_RESPONSES: dict[int | str, dict[str, Any]] = {
    200: {
        "description": "Action analyzed successfully (APPROVED / EXECUTED or PENDING_APPROVAL).",
        "content": {
            "application/json": {
                "example": {
                    "status": "PENDING_APPROVAL",
                    "decision": "REQUIRES_HUMAN_APPROVAL",
                    "requires_human_approval": True,
                    "approval_id": "appr_7f3a91b2",
                    "payload_hash": "a8b3c9f7112",
                    "authority_analysis": {
                        "agent_id": "agent-finance-01",
                        "evaluated_risk_level": "HIGH",
                        "risk_flags": ["INTENT_MISMATCH"],
                        "requires_strict_monitoring": True,
                    },
                    "intent_analysis": {
                        "similarity_score": 0.1142,
                        "threshold": 0.35,
                        "intent_matched": False,
                        "flag": "INTENT_MISMATCH",
                    },
                    "result": {
                        "status": "WAITING_FOR_APPROVAL",
                        "message": (
                            "Action suspended due to semantic intent mismatch between "
                            "user prompt and requested tool."
                        ),
                    },
                }
            }
        },
    },
    401: {"description": "Invalid or missing X-API-Key header."},
    403: {"description": "Action blocked by policy, DLP, or trust enforcement."},
    422: {"description": "Missing or invalid request body parameters (validation error)."},
}
