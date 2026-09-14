from __future__ import annotations

import json
import logging
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, Header, HTTPException, Query, Request, Response, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from nexus_governance.schemas import (
    AGENT_ACTION_OPENAPI_RESPONSES,
    AgentActionRequest,
    AgentActionResponse,
    AgentApprovalDecisionRequest,
    AgentApprovalDecisionResponse,
)

from nexus_governance.governance_framework import (
    AgentIdentityService,
    AgentRegistry,
    GovernanceFramework,
    ImmutableAuditTrail,
    IntentEngine,
    ToolApiGateway,
    TrajectoryEngine,
    _EXFILTRATION_FLAG,
    _INTENT_MISMATCH_FLAG,
    _PENDING_RESULT,
    _TRAJECTORY_VIOLATION_FLAG,
    authority_requires_hitl,
)
from nexus_governance.models import (
    AuditTrailResponse,
    GovernanceStatusResponse,
    ProofCenterMetricsResponse,
    ProofCenterRunResponse,
)
from nexus_governance.proof_center import load_proof_center_metrics, run_proof_center_benchmark
from nexus_governance.nexus_action_firewall import ActionFirewall
from nexus_governance.nexus_agent_identity import AgentProfile, EffectiveAuthorityEngine
from nexus_governance.nexus_policy_engine import policy_manager
from nexus_governance.redis_store import GovernanceRedisStore
from nexus_observability import log_violation

logger = logging.getLogger("nexus.governance")

router = APIRouter(tags=["Agent Governance"])

agent_router = APIRouter(
    prefix="/v1/agent",
    tags=["AI Agent Governance & MCP Security"],
)

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "*",
}


class MCPInspectRequest(BaseModel):
    mcp_payload: dict[str, Any]
    agent_trust_score: float = Field(default=100.0, ge=0.0, le=100.0)
    divergence_score: float = Field(default=0.0, ge=0.0, le=1.0)


def _apply_cors(response: Response) -> None:
    for key, value in CORS_HEADERS.items():
        response.headers[key] = value


def _serialize_evidence(evidence: Any) -> dict[str, Any] | None:
    if evidence is None:
        return None
    if hasattr(evidence, "model_dump"):
        return evidence.model_dump()
    if isinstance(evidence, dict):
        return evidence
    return None


def _mock_agent_profile(agent_id: str) -> AgentProfile:
    return AgentRegistry.ensure(agent_id)


def _extract_session_id(http_request: Request) -> str:
    return (
        http_request.headers.get("X-Session-Id")
        or http_request.headers.get("x-session-id")
        or "default-session"
    )


def _normalize_authority_analysis(authority_raw: dict[str, Any]) -> dict[str, Any]:
    level = authority_raw.get("evaluated_risk_level", "LOW")
    if hasattr(level, "value"):
        level = level.value
    return {
        **authority_raw,
        "evaluated_risk_level": str(level),
    }


def _build_authority_analysis(profile: AgentProfile) -> dict[str, Any]:
    authority_raw = EffectiveAuthorityEngine.analyze_authority_risk(profile)
    return _normalize_authority_analysis(authority_raw)


def _authority_analysis_from_evaluation(evaluation: Any) -> dict[str, Any] | None:
    authority = evaluation.authority
    if authority is None:
        return None
    return _normalize_authority_analysis(
        {
            "agent_id": authority.agent_id,
            "evaluated_risk_level": authority.evaluated_risk_level,
            "risk_flags": authority.risk_flags,
            "requires_strict_monitoring": authority.requires_strict_monitoring,
        }
    )


def _requires_hitl_approval(authority_analysis: dict[str, Any]) -> bool:
    return (
        authority_requires_hitl(authority_analysis)
        or policy_manager.requires_human_approval(authority_analysis)
    )


def _firewall_divergence_score(risk_flags: list[str]) -> float:
    return 0.9 if _EXFILTRATION_FLAG in risk_flags else 0.0


async def _manage_trajectory_session(session_id: str, tool_name: str) -> tuple[list[str], bool]:
    """
    Read Redis trajectory history, evaluate exfil sequence against prior tools,
    then append the current tool to trajectory:{session_id}.
    """
    history_before = await GovernanceRedisStore.get_trajectory_tools(session_id)
    print(f"[TRAJECTORY DEBUG] Session: {session_id} | History: {history_before} | Current: {tool_name}")
    violation = TrajectoryEngine._detect_invoice_exfiltration(history_before, tool_name)
    session_history = await GovernanceRedisStore.push_trajectory_tool(session_id, tool_name)
    return session_history, violation


def _apply_trajectory_override(authority_analysis: dict[str, Any], agent_id: str) -> dict[str, Any]:
    return {
        **authority_analysis,
        "agent_id": agent_id,
        "evaluated_risk_level": "CRITICAL",
        "risk_flags": [_EXFILTRATION_FLAG, _TRAJECTORY_VIOLATION_FLAG],
        "requires_strict_monitoring": True,
    }


def _trajectory_supplemental(session_history: list[str], agent_id: str) -> dict[str, Any]:
    return {
        "trajectory": [
            {"index": index, "tool_name": item, "agent_id": agent_id, "timestamp_utc": ""}
            for index, item in enumerate(session_history, start=1)
        ],
    }


async def _enforce_hitl_response(
    *,
    agent_id: str,
    tool_name: str,
    session_id: str,
    arguments: dict[str, Any],
    authority_analysis: dict[str, Any],
    supplemental: dict[str, Any] | None = None,
) -> JSONResponse:
    approval_id = f"appr_{uuid4().hex[:8]}"
    evidence_raw = await GovernanceFramework.record_authority_enforcement_pending(
        agent_id=agent_id,
        session_id=session_id,
        tool_name=tool_name,
        arguments=arguments,
        authority_analysis=authority_analysis,
        approval_id=approval_id,
    )
    merged_supplemental = dict(supplemental or {})
    merged_supplemental.setdefault("evidence", evidence_raw)
    return _pending_approval_json_response(
        _pending_approval_content(
            agent_id=agent_id,
            tool_name=tool_name,
            authority_analysis=authority_analysis,
            approval_id=approval_id,
            supplemental=merged_supplemental,
        )
    )


def _pending_approval_content(
    *,
    agent_id: str,
    tool_name: str,
    authority_analysis: dict[str, Any],
    approval_id: str | None = None,
    supplemental: dict[str, Any] | None = None,
) -> dict[str, Any]:
    content: dict[str, Any] = {
        "status": "PENDING_APPROVAL",
        "decision": "REQUIRES_HUMAN_APPROVAL",
        "requires_human_approval": True,
        "approval_id": approval_id or f"appr_{uuid4().hex[:8]}",
        "authority_analysis": authority_analysis,
        "policy": {
            "agent_id": agent_id,
            "tool_name": tool_name,
            "decision": "REQUIRES_HUMAN_APPROVAL",
        },
        "result": dict(_PENDING_RESULT),
    }
    if supplemental:
        for key in ("evidence", "trajectory", "trajectory_frame", "governance", "intent_analysis"):
            if key in supplemental:
                content[key] = supplemental[key]
    intent_analysis = (supplemental or {}).get("intent_analysis")
    if intent_analysis is None and supplemental and supplemental.get("governance"):
        intent = supplemental["governance"].get("intent") or {}
        intent_analysis = intent.get("intent_analysis")
    if intent_analysis is not None:
        content["intent_analysis"] = intent_analysis
    evidence = (supplemental or {}).get("evidence")
    if isinstance(evidence, dict) and evidence.get("payload_hash"):
        content["payload_hash"] = evidence["payload_hash"]
    risk_flags = authority_analysis.get("risk_flags") or []
    if _INTENT_MISMATCH_FLAG in risk_flags:
        content["result"] = {
            "status": "WAITING_FOR_APPROVAL",
            "message": (
                "Action suspended due to semantic intent mismatch between user prompt "
                "and requested tool."
            ),
        }
    return content


def _pending_approval_json_response(content: dict[str, Any]) -> JSONResponse:
    response = JSONResponse(status_code=200, content=content)
    _apply_cors(response)
    return response


def _evaluation_supplemental(evaluation: Any) -> dict[str, Any]:
    trajectory = evaluation.trajectory
    intent_analysis = None
    if evaluation.intent is not None:
        intent_analysis = evaluation.intent.intent_analysis
    supplemental = {
        "trajectory": [step.model_dump() for step in trajectory.trajectory] if trajectory else [],
        "trajectory_frame": trajectory.model_dump() if trajectory else None,
        "evidence": _serialize_evidence(evaluation.evidence),
        "governance": evaluation.model_dump(),
    }
    if intent_analysis is not None:
        supplemental["intent_analysis"] = intent_analysis
    return supplemental


def _action_response_payload(
    evaluation: Any,
    *,
    status: str,
    agent_id: str | None = None,
    tool_name: str | None = None,
) -> dict[str, Any]:
    trajectory = evaluation.trajectory
    policy = evaluation.policy.model_dump() if evaluation.policy else {"decision": evaluation.decision}
    if agent_id:
        policy["agent_id"] = agent_id
    if tool_name:
        policy["tool_name"] = tool_name

    payload: dict[str, Any] = {
        "status": status,
        "decision": evaluation.decision,
        "requires_human_approval": evaluation.requires_human_approval,
        "approval_id": evaluation.approval_id,
        "policy": policy,
        "trajectory": [step.model_dump() for step in trajectory.trajectory] if trajectory else [],
        "trajectory_frame": trajectory.model_dump() if trajectory else None,
        "evidence": _serialize_evidence(evaluation.evidence),
        "governance": evaluation.model_dump(),
    }

    authority_analysis = _authority_analysis_from_evaluation(evaluation)
    if authority_analysis is not None:
        payload["authority_analysis"] = authority_analysis

    if evaluation.requires_human_approval or status == "PENDING_APPROVAL":
        payload["result"] = dict(_PENDING_RESULT)

    return payload


async def _handle_blocked_evaluation(
    evaluation: Any,
    *,
    tool_name: str,
    session_id: str,
    agent_id: str,
    arguments: dict[str, Any],
) -> None:
    evidence_payload = _serialize_evidence(evaluation.evidence)
    reason = evaluation.block_reason or (
        getattr(evaluation.evidence, "status", "POLICY_VIOLATION") if evaluation.evidence else "POLICY_VIOLATION"
    )
    log_violation(
        service="nexus-shield-api-prod",
        violation_type=reason,
        matched_rule=tool_name,
        evidence_snippet=json.dumps(arguments, sort_keys=True)[:200],
        method="POST",
        path="/v1/agent/action",
        client_ip="internal",
        extra={
            "agent_id": agent_id,
            "session_id": session_id,
            "trust_score": evaluation.trust_score,
        },
    )
    detail: dict[str, Any] = {
        "status": "BLOCKED",
        "decision": "BLOCK",
        "requires_human_approval": False,
        "policy": evaluation.policy.model_dump() if evaluation.policy else {"decision": "BLOCK", "reason": reason},
        "reason": reason,
        "trajectory": [step.model_dump() for step in evaluation.trajectory.trajectory]
        if evaluation.trajectory
        else [],
        "evidence": evidence_payload,
        "governance": evaluation.model_dump(),
    }
    if reason == "DLP_VIOLATION":
        detail["dlp_violation"] = True
    raise HTTPException(status_code=403, detail=detail)


@agent_router.options("/action")
async def agent_action_preflight(response: Response) -> dict[str, str]:
    _apply_cors(response)
    return {"status": "ok"}


@router.options("/v1/governance/status")
@router.options("/api/governance/status")
@router.options("/v1/governance/audit-trail")
@router.options("/api/governance/audit-trail")
@router.options("/api/proof-center")
@router.options("/api/proof-center/run")
async def governance_preflight(response: Response) -> dict[str, str]:
    _apply_cors(response)
    return {"status": "ok"}


@router.get("/v1/governance/status", response_model=GovernanceStatusResponse)
@router.get("/api/governance/status", response_model=GovernanceStatusResponse)
async def governance_status(response: Response) -> GovernanceStatusResponse:
    _apply_cors(response)
    return GovernanceFramework.status_response()


@router.get("/v1/governance/audit-trail", response_model=AuditTrailResponse)
@router.get("/api/governance/audit-trail", response_model=AuditTrailResponse)
async def governance_audit_trail(
    response: Response,
    limit: int = Query(default=50, ge=1, le=200),
) -> AuditTrailResponse:
    _apply_cors(response)
    return await ImmutableAuditTrail.audit_response(limit=limit)


@router.get("/api/proof-center", response_model=ProofCenterMetricsResponse)
async def proof_center_metrics(response: Response) -> ProofCenterMetricsResponse:
    _apply_cors(response)
    return ProofCenterMetricsResponse.model_validate(load_proof_center_metrics())


@router.post("/api/proof-center/run", response_model=ProofCenterRunResponse)
async def proof_center_run(response: Response) -> ProofCenterRunResponse:
    _apply_cors(response)
    result = await run_proof_center_benchmark()
    return ProofCenterRunResponse.model_validate(result)


@agent_router.post(
    "/action",
    response_model=AgentActionResponse,
    status_code=status.HTTP_200_OK,
    summary="Agent Action Inspection & Governance",
    description=(
        "Inspects Model Context Protocol (MCP) and AI agent actions. Runs Trajectory Engine, "
        "Intent Engine (cosine similarity), and Human-in-the-Loop (HITL) workflows to "
        "approve (APPROVED/EXECUTED) or suspend (PENDING_APPROVAL) the action."
    ),
    responses=AGENT_ACTION_OPENAPI_RESPONSES,
)
async def inspect_agent_action(
    payload: AgentActionRequest,
    response: Response,
    x_nexus_agent_id: str = Header(
        ...,
        alias="X-Nexus-Agent-Id",
        description="Unique agent identifier",
    ),
    x_session_id: str = Header(
        ...,
        alias="X-Session-Id",
        description="Session / trajectory tracking identifier",
    ),
    x_nexus_agent_token: str | None = Header(
        default=None,
        alias="X-Nexus-Agent-Token",
        description="Optional agent authentication token",
    ),
    x_delegator_agent_id: str | None = Header(
        default=None,
        alias="X-Delegator-Agent-Id",
        description="Optional delegator agent for trust-chain verification",
    ),
):
    """Evaluate an agent tool call through the unified governance framework."""
    _apply_cors(response)
    session_id = x_session_id
    tool_name = payload.tool_name.strip().lower()
    declared_intent = payload.user_prompt or payload.user_intent
    tool_purpose = payload.tool_purpose or ""

    intent_details: dict[str, Any] | None = None
    if payload.user_prompt:
        intent_ctx = IntentEngine.evaluate(declared_intent, tool_name, tool_purpose)
        intent_details = intent_ctx.intent_analysis
        if intent_ctx.intent_mismatch:
            authority_preflight = _build_authority_analysis(_mock_agent_profile(x_nexus_agent_id))
            authority_preflight["evaluated_risk_level"] = "HIGH"
            merged_flags = list(dict.fromkeys([*authority_preflight.get("risk_flags", []), _INTENT_MISMATCH_FLAG]))
            authority_preflight["risk_flags"] = merged_flags
            authority_preflight["requires_strict_monitoring"] = True
            authority_preflight["agent_id"] = x_nexus_agent_id
            return await _enforce_hitl_response(
                agent_id=x_nexus_agent_id,
                tool_name=tool_name,
                session_id=session_id,
                arguments=payload.arguments,
                authority_analysis=authority_preflight,
                supplemental={
                    "intent_analysis": intent_details,
                    "governance": {"intent": intent_ctx.model_dump()},
                },
            )

    session_history, trajectory_violation = await _manage_trajectory_session(session_id, tool_name)

    profile = _mock_agent_profile(x_nexus_agent_id)
    authority_analysis = _build_authority_analysis(profile)
    if trajectory_violation:
        authority_analysis = _apply_trajectory_override(authority_analysis, x_nexus_agent_id)

    identity = AgentIdentityService.verify(x_nexus_agent_id, x_nexus_agent_token)
    policy_result = ToolApiGateway.evaluate_tool(
        x_nexus_agent_id,
        session_id,
        tool_name,
        payload.arguments,
    )
    if not identity.token_valid or not policy_result.allowed:
        blocked_evaluation = await GovernanceFramework.evaluate_action(
            agent_id=x_nexus_agent_id,
            session_id=session_id,
            tool_name=tool_name,
            arguments=payload.arguments,
            user_intent=declared_intent,
            tool_purpose=tool_purpose,
            divergence_score=payload.divergence_score,
            delegator=x_delegator_agent_id,
            agent_token=x_nexus_agent_token,
            trajectory_recorded=True,
        )
        await _handle_blocked_evaluation(
            blocked_evaluation,
            tool_name=tool_name,
            session_id=session_id,
            agent_id=x_nexus_agent_id,
            arguments=payload.arguments,
        )

    risk_level = authority_analysis.get("evaluated_risk_level")
    risk_flags = authority_analysis.get("risk_flags", [])

    if _requires_hitl_approval(authority_analysis):
        supplemental = _trajectory_supplemental(session_history, x_nexus_agent_id) if trajectory_violation else None
        return await _enforce_hitl_response(
            agent_id=x_nexus_agent_id,
            tool_name=tool_name,
            session_id=session_id,
            arguments=payload.arguments,
            authority_analysis=authority_analysis,
            supplemental=supplemental,
        )

    divergence_score = _firewall_divergence_score(risk_flags)
    ActionFirewall.evaluate(
        trust_score=profile.dynamic_trust_score,
        divergence_score=divergence_score,
        tool_name=tool_name,
        action_params=payload.arguments,
    )

    evaluation = await GovernanceFramework.evaluate_action(
        agent_id=x_nexus_agent_id,
        session_id=session_id,
        tool_name=tool_name,
        arguments=payload.arguments,
        user_intent=declared_intent,
        tool_purpose=tool_purpose,
        divergence_score=max(payload.divergence_score, divergence_score),
        delegator=x_delegator_agent_id,
        agent_token=x_nexus_agent_token,
        trajectory_recorded=True,
    )

    if evaluation.decision == "BLOCK":
        await _handle_blocked_evaluation(
            evaluation,
            tool_name=tool_name,
            session_id=session_id,
            agent_id=x_nexus_agent_id,
            arguments=payload.arguments,
        )

    if evaluation.decision in {"REQUIRES_HUMAN_APPROVAL", "REQUIRE_HUMAN_APPROVAL"}:
        authority_analysis = _authority_analysis_from_evaluation(evaluation) or authority_analysis
        hitl_response = _pending_approval_json_response(
            _pending_approval_content(
                agent_id=x_nexus_agent_id,
                tool_name=tool_name,
                authority_analysis=authority_analysis,
                approval_id=evaluation.approval_id,
                supplemental=_evaluation_supplemental(evaluation),
            )
        )
        evidence = evaluation.evidence
        if evidence and hasattr(evidence, "payload_hash"):
            hitl_response.headers["X-Nexus-Evidence-Hash"] = evidence.payload_hash
        if evaluation.approval_id:
            hitl_response.headers["X-Nexus-Approval-Id"] = evaluation.approval_id
        return hitl_response

    if evaluation.decision == "DEGRADE_READ_ONLY":
        return _action_response_payload(
            evaluation,
            status="DEGRADED",
            agent_id=x_nexus_agent_id,
            tool_name=tool_name,
        )

    final_authority = _authority_analysis_from_evaluation(evaluation) or authority_analysis
    if evaluation.decision == "ALLOW" and _requires_hitl_approval(final_authority):
        return await _enforce_hitl_response(
            agent_id=x_nexus_agent_id,
            tool_name=tool_name,
            session_id=session_id,
            arguments=payload.arguments,
            authority_analysis=final_authority,
            supplemental=_evaluation_supplemental(evaluation),
        )

    evidence = evaluation.evidence
    if evidence and hasattr(evidence, "payload_hash"):
        response.headers["X-Nexus-Evidence-Hash"] = evidence.payload_hash

    return _action_response_payload(
        evaluation,
        status="EXECUTED",
        agent_id=x_nexus_agent_id,
        tool_name=tool_name,
    )


# Backward-compatible alias for legacy imports and tests.
execute_agent_action = inspect_agent_action


@agent_router.post(
    "/approval/decision",
    response_model=AgentApprovalDecisionResponse,
    status_code=status.HTTP_200_OK,
    summary="Human-in-the-Loop Approval Decision",
    description=(
        "Records a human reviewer decision (APPROVED or REJECTED) for a pending "
        "agent action identified by approval_id."
    ),
    responses={
        200: {"description": "Approval decision recorded."},
        404: {"description": "Unknown or expired approval_id."},
        422: {"description": "Invalid request body."},
    },
)
async def resolve_agent_approval_decision(
    payload: AgentApprovalDecisionRequest,
    response: Response,
    x_nexus_agent_id: str = Header(
        ...,
        alias="X-Nexus-Agent-Id",
        description="Reviewing operator or agent context identifier",
    ),
):
    """Close a pending HITL workflow with APPROVED or REJECTED."""
    _apply_cors(response)
    try:
        result = await GovernanceFramework.resolve_hitl_decision(
            approval_id=payload.approval_id.strip(),
            decision=payload.decision.value,
            reviewer_notes=payload.reviewer_notes or "",
            reviewer_agent_id=x_nexus_agent_id,
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    hitl_response = JSONResponse(status_code=200, content=result)
    evidence = result.get("evidence") or {}
    if evidence.get("payload_hash"):
        hitl_response.headers["X-Nexus-Evidence-Hash"] = evidence["payload_hash"]
    hitl_response.headers["X-Nexus-Approval-Id"] = payload.approval_id
    return hitl_response


@router.post("/v1/mcp/inspect")
async def inspect_mcp_request(payload: MCPInspectRequest, response: Response) -> dict[str, Any]:
    _apply_cors(response)
    result = await GovernanceFramework.inspect_mcp(
        payload.mcp_payload,
        payload.agent_trust_score,
        payload.divergence_score,
    )
    result["governance_modules"] = GovernanceFramework.module_status_map()
    return result
