from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Header, HTTPException, Response
from pydantic import BaseModel, Field

from nexus_governance.nexus_action_firewall import ActionFirewall, EnforcementDecision
from nexus_governance.nexus_agent_identity import (
    AgentProfile,
    EffectiveAuthorityEngine,
    RiskLevel,
)
from nexus_governance.nexus_evidence_engine import EvidenceEngine
from nexus_governance.nexus_mcp_proxy import MCPProxyInspector

router = APIRouter(tags=["Agent Governance"])


class AgentActionRequest(BaseModel):
    tool_name: str
    arguments: dict[str, Any] = Field(default_factory=dict)


class MCPInspectRequest(BaseModel):
    mcp_payload: dict[str, Any]
    agent_trust_score: float = Field(default=100.0, ge=0.0, le=100.0)
    divergence_score: float = Field(default=0.0, ge=0.0, le=1.0)


def _mock_agent_profile(agent_id: str) -> AgentProfile:
    """Production'da Redis/DB'den çekilir."""
    return AgentProfile(
        agent_id=agent_id,
        owner_dept="Finance",
        purpose="Invoice Processing",
        risk_level=RiskLevel.MEDIUM,
        effective_permissions=["db:read", "api:external_post", "finance:execute"],
        dynamic_trust_score=100.0,
    )


@router.post("/v1/agent/action")
async def process_agent_action(
    request: AgentActionRequest,
    response: Response,
    x_nexus_agent_id: str = Header(..., alias="X-Nexus-Agent-Id"),
    x_session_id: str = Header(..., alias="X-Session-Id"),
) -> dict[str, Any]:
    profile = _mock_agent_profile(x_nexus_agent_id)
    authority_analysis = EffectiveAuthorityEngine.analyze_authority_risk(profile)

    decision = ActionFirewall.evaluate(
        trust_score=profile.dynamic_trust_score,
        divergence_score=0.0,
        tool_name=request.tool_name,
        action_params=request.arguments,
    )

    if decision == EnforcementDecision.BLOCK:
        raise HTTPException(
            status_code=403,
            detail={
                "status": "BLOCKED",
                "reason": "Policy violation or anomalous behavior detected.",
                "authority_flags": authority_analysis["risk_flags"],
            },
        )

    if decision == EnforcementDecision.REQUIRE_HUMAN_APPROVAL:
        return {
            "status": "PENDING_APPROVAL",
            "message": "Action requires human authorization before execution.",
            "decision": decision.value,
            "authority_analysis": authority_analysis,
        }

    if decision == EnforcementDecision.DEGRADE_READ_ONLY:
        return {
            "status": "DEGRADED",
            "message": "Agent restricted to read-only mode due to low trust score.",
            "decision": decision.value,
            "authority_analysis": authority_analysis,
        }

    execution_result = {
        "status": "SUCCESS",
        "message": f"Tool '{request.tool_name}' executed successfully.",
    }

    evidence = EvidenceEngine.generate_evidence(
        session_id=x_session_id,
        agent_id=profile.agent_id,
        tool_name=request.tool_name,
        action_payload=request.arguments,
        execution_result=execution_result,
    )

    response.headers["X-Nexus-Evidence-Hash"] = evidence["payload_hash"]

    return {
        "status": "EXECUTED",
        "decision": decision.value,
        "result": execution_result,
        "evidence": evidence,
        "authority_analysis": authority_analysis,
    }


@router.post("/v1/mcp/inspect")
async def inspect_mcp_request(payload: MCPInspectRequest) -> dict[str, Any]:
    return await MCPProxyInspector.inspect_mcp_request(
        mcp_payload=payload.mcp_payload,
        agent_trust_score=payload.agent_trust_score,
        divergence_score=payload.divergence_score,
    )
