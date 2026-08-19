from __future__ import annotations

import json
import logging
from typing import Any

from fastapi import APIRouter, Header, HTTPException, Response
from pydantic import BaseModel, Field

from nexus_governance.governance_framework import GovernanceFramework
from nexus_governance.models import GovernanceStatusResponse
from nexus_observability import log_violation

logger = logging.getLogger("nexus.governance")

router = APIRouter(tags=["Agent Governance"])


class AgentActionRequest(BaseModel):
    tool_name: str
    arguments: dict[str, Any] = Field(default_factory=dict)
    user_intent: str = Field(default="Process finance workflow")
    divergence_score: float = Field(default=0.0, ge=0.0, le=1.0)


class MCPInspectRequest(BaseModel):
    mcp_payload: dict[str, Any]
    agent_trust_score: float = Field(default=100.0, ge=0.0, le=100.0)
    divergence_score: float = Field(default=0.0, ge=0.0, le=1.0)


@router.get("/v1/governance/status", response_model=GovernanceStatusResponse)
@router.get("/api/governance/status", response_model=GovernanceStatusResponse)
async def governance_status() -> GovernanceStatusResponse:
    return GovernanceFramework.status_response()


@router.post("/v1/agent/action")
async def process_agent_action(
    request: AgentActionRequest,
    response: Response,
    x_nexus_agent_id: str = Header(..., alias="X-Nexus-Agent-Id"),
    x_session_id: str = Header(..., alias="X-Session-Id"),
    x_nexus_agent_token: str | None = Header(default=None, alias="X-Nexus-Agent-Token"),
    x_delegator_agent_id: str | None = Header(default=None, alias="X-Delegator-Agent-Id"),
) -> dict[str, Any]:
    evaluation = GovernanceFramework.evaluate_action(
        agent_id=x_nexus_agent_id,
        session_id=x_session_id,
        tool_name=request.tool_name,
        arguments=request.arguments,
        user_intent=request.user_intent,
        divergence_score=request.divergence_score,
        delegator=x_delegator_agent_id,
        agent_token=x_nexus_agent_token,
    )

    if evaluation.decision == "BLOCK":
        evidence_payload = (
            evaluation.evidence.model_dump()
            if hasattr(evaluation.evidence, "model_dump")
            else evaluation.evidence
        )
        reason = evaluation.block_reason or (
            getattr(evaluation.evidence, "status", "POLICY_VIOLATION") if evaluation.evidence else "POLICY_VIOLATION"
        )
        log_violation(
            service="nexus-shield-api-prod",
            violation_type=reason,
            matched_rule=request.tool_name,
            evidence_snippet=json.dumps(request.arguments, sort_keys=True)[:200],
            method="POST",
            path="/v1/agent/action",
            client_ip="internal",
            extra={
                "agent_id": x_nexus_agent_id,
                "session_id": x_session_id,
                "trust_score": evaluation.trust_score,
            },
        )
        detail: dict[str, Any] = {
            "status": "BLOCKED",
            "decision": "BLOCK",
            "reason": reason,
            "evidence": evidence_payload,
            "governance": evaluation.model_dump(),
        }
        if reason == "DLP_VIOLATION":
            detail["dlp_violation"] = True
        raise HTTPException(status_code=403, detail=detail)

    if evaluation.decision in {"REQUIRE_HUMAN_APPROVAL", "DEGRADE_READ_ONLY"}:
        return {
            "status": "PENDING_APPROVAL" if evaluation.decision == "REQUIRE_HUMAN_APPROVAL" else "DEGRADED",
            "decision": evaluation.decision,
            "governance": evaluation.model_dump(),
        }

    evidence = evaluation.evidence
    if evidence and hasattr(evidence, "payload_hash"):
        response.headers["X-Nexus-Evidence-Hash"] = evidence.payload_hash

    return {
        "status": "EXECUTED",
        "decision": evaluation.decision,
        "evidence": evidence.model_dump() if hasattr(evidence, "model_dump") else evidence,
        "governance": evaluation.model_dump(),
    }


@router.post("/v1/mcp/inspect")
async def inspect_mcp_request(payload: MCPInspectRequest) -> dict[str, Any]:
    result = await GovernanceFramework.inspect_mcp(
        payload.mcp_payload,
        payload.agent_trust_score,
        payload.divergence_score,
    )
    result["governance_modules"] = GovernanceFramework.module_status_map()
    return result
