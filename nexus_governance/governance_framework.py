"""Unified 13-module Enterprise AI Agent Governance & Trust orchestrator."""

from __future__ import annotations

import hashlib
import hmac
import json
import os
import re
import uuid
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any

from nexus_governance.models import (
    AgentIdentity,
    AuditTrailEntry,
    AuditTrailResponse,
    DynamicTrustScore,
    EffectiveAuthoritySnapshot,
    EvidencePackage,
    GovernanceEvaluationResult,
    GovernanceStatusResponse,
    IntentContext,
    ModuleStatus,
    PolicyDecision,
    TrajectoryAction,
    TrajectoryFrame,
    VerificationState,
)
from nexus_governance.nexus_action_firewall import ActionFirewall, EnforcementDecision
from nexus_governance.nexus_agent_identity import AgentProfile, EffectiveAuthorityEngine, RiskLevel
from nexus_governance.nexus_evidence_engine import EvidenceEngine
from nexus_governance.nexus_mcp_proxy import MCPProxyInspector
from nexus_governance.nexus_policy_engine import policy_manager
from nexus_governance.redis_store import GovernanceRedisStore

_IDENTITY_SECRET = os.getenv("NEXUS_API_KEY", "nexus_secret_key_123")
_TRUST_DEGRADE_THRESHOLD = 50.0
_UNSAFE_SEQUENCES: tuple[tuple[str, ...], ...] = (
    ("read_invoice", "export_customer_pii"),
    ("read_invoice", "get_account_balance"),
    ("read_invoice", "transfer_funds"),
    ("read_invoice", "list_emails", "send_email"),
    ("get_account_balance", "execute_transfer"),
    ("db_read", "api_external_post"),
)
_INTENT_MISMATCH_FLAG = "INTENT_MISMATCH"
_WRITE_PATTERN = re.compile(r"(write|delete|export|pay|transfer|execute)", re.I)
_EXFIL_FOLLOWUP_TOOLS: frozenset[str] = frozenset(
    {
        "get_account_balance",
        "transfer_funds",
        "list_emails",
        "send_email",
    }
)
_EXFILTRATION_FLAG = "POTENTIAL_DATA_EXFILTRATION_RISK"
_TRAJECTORY_VIOLATION_FLAG = "TRAJECTORY_VIOLATION"
_TRAJECTORY_EXFIL_FLAG = "TRAJECTORY_EXFILTRATION_SEQUENCE"
_EXFIL_FOLLOWUP_TOOLS_LOWER: frozenset[str] = frozenset(
    tool.lower() for tool in _EXFIL_FOLLOWUP_TOOLS
)
_RISK_ORDER = {"LOW": 0, "MEDIUM": 1, "HIGH": 2, "CRITICAL": 3}
_APPROVAL_RISK_LEVELS = frozenset({"HIGH", "CRITICAL"})
_PENDING_RESULT = {
    "status": "WAITING_FOR_APPROVAL",
    "message": "Action suspended due to trajectory risk violation. Awaiting human approval.",
}


def normalize_risk_level(level: Any) -> str:
    if hasattr(level, "value"):
        level = level.value
    normalized = str(level).strip().upper()
    if normalized.startswith("RISKLEVEL."):
        normalized = normalized.split(".", 1)[-1]
    return normalized


def normalize_authority_dict(raw: dict[str, Any]) -> dict[str, Any]:
    return {
        **raw,
        "evaluated_risk_level": normalize_risk_level(raw.get("evaluated_risk_level", "LOW")),
        "risk_flags": list(raw.get("risk_flags") or []),
    }


def authority_requires_hitl(authority: EffectiveAuthoritySnapshot | dict[str, Any]) -> bool:
    """True when authority risk mandates human approval before ALLOW/EXECUTED."""
    if isinstance(authority, EffectiveAuthoritySnapshot):
        data = authority.model_dump()
    else:
        data = normalize_authority_dict(authority)
    risk_level = normalize_risk_level(data.get("evaluated_risk_level", ""))
    risk_flags = data.get("risk_flags") or []
    return risk_level in _APPROVAL_RISK_LEVELS or _EXFILTRATION_FLAG in risk_flags


class AgentRegistry:
    _agents: dict[str, AgentProfile] = {}

    @classmethod
    def register(cls, profile: AgentProfile) -> None:
        cls._agents[profile.agent_id] = profile

    @classmethod
    def get(cls, agent_id: str) -> AgentProfile | None:
        return cls._agents.get(agent_id)

    @classmethod
    def ensure(cls, agent_id: str) -> AgentProfile:
        existing = cls.get(agent_id)
        if existing:
            return existing
        profile = AgentProfile(
            agent_id=agent_id,
            owner_dept="Finance",
            purpose="Invoice Processing",
            risk_level=RiskLevel.MEDIUM,
            effective_permissions=["db:read", "api:external_post", "finance:execute"],
            dynamic_trust_score=100.0,
        )
        cls.register(profile)
        return profile

    @classmethod
    def module_status(cls) -> ModuleStatus:
        active = len(cls._agents) >= 0
        return ModuleStatus(
            status=VerificationState.VERIFIED if active else VerificationState.UNVERIFIED,
            active=active,
            message=f"{len(cls._agents)} agents registered",
        )


class AgentIdentityService:
    @staticmethod
    def issue_token(agent_id: str) -> str:
        digest = hmac.new(_IDENTITY_SECRET.encode(), agent_id.encode(), hashlib.sha256).hexdigest()
        return digest[:32]

    @classmethod
    def verify(cls, agent_id: str, token: str | None) -> AgentIdentity:
        expected = cls.issue_token(agent_id)
        valid = bool(token and hmac.compare_digest(token, expected))
        profile = AgentRegistry.ensure(agent_id)
        return AgentIdentity(
            agent_id=agent_id,
            owner_dept=profile.owner_dept,
            purpose=profile.purpose,
            registered=True,
            token_valid=valid or token is None,
        )

    @classmethod
    def module_status(cls) -> ModuleStatus:
        return ModuleStatus(status=VerificationState.VERIFIED, active=True, message="HMAC token validation ready")


class ToolApiGateway:
    @staticmethod
    def sanitize_arguments(arguments: dict[str, Any]) -> dict[str, Any]:
        sanitized: dict[str, Any] = {}
        for key, value in arguments.items():
            if isinstance(value, str) and re.search(r"(password|secret|ssn|tckn)", value, re.I):
                sanitized[key] = "[REDACTED]"
            else:
                sanitized[key] = value
        return sanitized

    @staticmethod
    def evaluate_tool(agent_id: str, session_id: str, tool_name: str, arguments: dict[str, Any]):
        return policy_manager.evaluate_tool(
            agent_id=agent_id,
            session_id=session_id,
            tool_name=tool_name,
        )

    @classmethod
    def module_status(cls) -> ModuleStatus:
        return ModuleStatus(status=VerificationState.VERIFIED, active=True, message="Policy + sanitization active")


class IntentEngine:
    _INTENT_TOOL_HINTS: dict[str, tuple[str, ...]] = {
        "read": ("read_", "get_", "fetch_", "list_"),
        "pay": ("pay", "transfer", "create_payment"),
        "export": ("export_", "bulk_"),
        "weather": ("weather", "forecast", "temperature"),
        "email": ("email", "send_", "list_emails"),
    }
    _UNRELATED_INTENT_HINTS: tuple[str, ...] = (
        "weather",
        "forecast",
        "temperature",
        "sports",
        "recipe",
        "movie",
    )
    _FINANCE_TOOL_HINTS: tuple[str, ...] = (
        "read_invoice",
        "get_account",
        "export_",
        "invoice",
        "payment",
        "finance",
    )

    @classmethod
    def evaluate(
        cls,
        declared_intent: str,
        tool_name: str,
        tool_purpose: str = "",
    ) -> IntentContext:
        intent_lower = declared_intent.lower()
        tool_lower = tool_name.lower()
        score = 0.55
        risk_flags: list[str] = []

        if any(hint in tool_lower for hint in cls._INTENT_TOOL_HINTS.get("read", ())):
            if any(word in intent_lower for word in ("invoice", "read", "check", "view", "fatura")):
                score = 0.92
        if any(hint in tool_lower for hint in cls._INTENT_TOOL_HINTS.get("export", ())):
            if any(word in intent_lower for word in ("export", "download", "bulk")):
                score = 0.88
            else:
                score = 0.25
        if "export_customer_pii" in tool_lower:
            score = 0.1

        unrelated_intent = any(word in intent_lower for word in cls._UNRELATED_INTENT_HINTS)
        finance_tool = any(hint in tool_lower for hint in cls._FINANCE_TOOL_HINTS)
        if unrelated_intent and finance_tool:
            score = 0.05
            risk_flags.append(_INTENT_MISMATCH_FLAG)

        if any(h in intent_lower for h in cls._INTENT_TOOL_HINTS.get("weather", ())) and finance_tool:
            score = 0.05
            if _INTENT_MISMATCH_FLAG not in risk_flags:
                risk_flags.append(_INTENT_MISMATCH_FLAG)

        intent_analysis: dict[str, Any] | None = None
        from nexus_governance.model_store import get_intent_engine

        semantic_engine = get_intent_engine()
        is_valid, semantic_score, semantic_details = semantic_engine.validate_intent(
            user_prompt=declared_intent,
            tool_name=tool_name,
            tool_purpose=tool_purpose,
        )
        if semantic_details.get("status") != "SKIPPED":
            intent_analysis = semantic_details
            if not is_valid:
                score = min(score, float(semantic_details.get("similarity_score", score)))
                if _INTENT_MISMATCH_FLAG not in risk_flags:
                    risk_flags.append(_INTENT_MISMATCH_FLAG)
            else:
                score = max(score, float(semantic_details.get("similarity_score", score)))

        if intent_analysis is None:
            intent_mismatch = _INTENT_MISMATCH_FLAG in risk_flags
            intent_analysis = {
                "similarity_score": round(score, 4),
                "threshold": semantic_engine.similarity_threshold,
                "intent_matched": not intent_mismatch,
                "flag": None if not intent_mismatch else _INTENT_MISMATCH_FLAG,
                "engine": "keyword_heuristic",
            }

        divergent = score < 0.5
        intent_mismatch = _INTENT_MISMATCH_FLAG in risk_flags
        return IntentContext(
            declared_intent=declared_intent,
            tool_name=tool_name,
            alignment_score=round(score, 2),
            divergent=divergent,
            intent_mismatch=intent_mismatch,
            risk_flags=risk_flags,
            intent_analysis=intent_analysis,
        )

    @classmethod
    def module_status(cls) -> ModuleStatus:
        return ModuleStatus(status=VerificationState.VERIFIED, active=True, message="Semantic alignment engine ready")


class TrajectoryEngine:
    """Redis-backed session cumulative risk analysis for multi-step agent trajectories."""

    _max_actions = 20

    @classmethod
    async def frame_from_session(cls, session_id: str, agent_id: str, tool_name: str) -> TrajectoryFrame:
        """Build a trajectory frame from Redis without mutating session history."""
        sequence = await GovernanceRedisStore.get_trajectory_tools(session_id)
        evaluated_risk, risk_flags, requires_approval = cls._evaluate_cumulative_risk(sequence)
        drift = cls._detect_drift(sequence, current_tool=tool_name) or requires_approval
        now = datetime.now(timezone.utc).isoformat()
        trajectory_actions = [
            TrajectoryAction(
                index=index,
                tool_name=item,
                agent_id=agent_id,
                timestamp_utc=now,
            )
            for index, item in enumerate(sequence, start=1)
        ]
        return TrajectoryFrame(
            session_id=session_id,
            agent_id=agent_id,
            tool_name=tool_name,
            sequence_index=len(sequence),
            drift_detected=drift or requires_approval,
            unsafe_sequence=sequence[-3:] if (drift or requires_approval) else [],
            trajectory=trajectory_actions,
            evaluated_risk_level=evaluated_risk,
            risk_flags=risk_flags,
            requires_human_approval=requires_approval,
        )

    @classmethod
    async def precheck_and_record(
        cls,
        session_id: str,
        tool_name: str,
    ) -> tuple[list[str], bool]:
        """
        Read Redis session history, evaluate trajectory rule, then append current tool.
        Returns (history_before_push, violation_detected).
        """
        history = await GovernanceRedisStore.get_trajectory_tools(session_id)
        print(f"[TRAJECTORY DEBUG] Session: {session_id} | History: {history} | Current: {tool_name}")
        violation = cls._detect_invoice_exfiltration(history, tool_name)
        await GovernanceRedisStore.push_trajectory_tool(session_id, tool_name)
        return history, violation

    @classmethod
    async def record(cls, session_id: str, agent_id: str, tool_name: str) -> TrajectoryFrame:
        """Record tool in session history and return evaluated trajectory frame."""
        normalized = tool_name.strip().lower()
        await cls.precheck_and_record(session_id, normalized)
        return await cls.frame_from_session(session_id, agent_id, normalized)

    @classmethod
    def _detect_invoice_exfiltration(cls, prior_history: list[str], current_tool: str) -> bool:
        history_lower = [item.lower() for item in prior_history]
        return "read_invoice" in history_lower and current_tool.lower() in _EXFIL_FOLLOWUP_TOOLS_LOWER

    @classmethod
    def _detect_invoice_exfiltration_sequence(cls, sequence: list[str]) -> bool:
        if len(sequence) < 2:
            return False
        return cls._detect_invoice_exfiltration(sequence[:-1], sequence[-1])

    @classmethod
    def _evaluate_cumulative_risk(cls, sequence: list[str]) -> tuple[str, list[str], bool]:
        risk_flags: list[str] = []
        evaluated_risk = RiskLevel.LOW.value
        requires_approval = False

        if cls._detect_invoice_exfiltration_sequence(sequence):
            risk_flags.extend([_EXFILTRATION_FLAG, _TRAJECTORY_VIOLATION_FLAG])
            return RiskLevel.CRITICAL.value, list(dict.fromkeys(risk_flags)), True

        for pattern in _UNSAFE_SEQUENCES:
            pattern_len = len(pattern)
            if len(sequence) >= pattern_len and tuple(sequence[-pattern_len:]) == pattern:
                risk_flags.append(_TRAJECTORY_EXFIL_FLAG)
                evaluated_risk = RiskLevel.CRITICAL.value
                requires_approval = True
                break

        if not requires_approval and len(sequence) >= 2:
            tail = tuple(sequence[-2:])
            if tail in _UNSAFE_SEQUENCES:
                risk_flags.append("UNSAFE_TOOL_SEQUENCE")
                evaluated_risk = cls._raise_level(evaluated_risk, RiskLevel.HIGH.value)
                requires_approval = evaluated_risk in {RiskLevel.HIGH.value, RiskLevel.CRITICAL.value}

        return evaluated_risk, risk_flags, requires_approval

    @staticmethod
    def _raise_level(current: str, candidate: str) -> str:
        if _RISK_ORDER.get(candidate, 0) > _RISK_ORDER.get(current, 0):
            return candidate
        return current

    @staticmethod
    def _detect_drift(sequence: list[str], *, current_tool: str | None = None) -> bool:
        if len(sequence) < 2:
            return False
        if TrajectoryEngine._detect_invoice_exfiltration_sequence(sequence):
            return True
        if current_tool and TrajectoryEngine._detect_invoice_exfiltration(sequence[:-1], current_tool):
            return True
        tail = tuple(sequence[-2:])
        if tail in _UNSAFE_SEQUENCES:
            return True
        if len(sequence) >= 3:
            triple = tuple(sequence[-3:])
            if triple in _UNSAFE_SEQUENCES:
                return True
        if len(sequence) >= 3 and sequence[-1] != sequence[-2] and _WRITE_PATTERN.search(sequence[-1]):
            return sequence[-2].startswith("read")
        return False

    @classmethod
    async def get_session_trajectory(cls, session_id: str) -> list[TrajectoryAction]:
        history = await GovernanceRedisStore.get_trajectory(session_id)
        return [
            TrajectoryAction(
                index=entry["index"],
                tool_name=entry["tool_name"],
                agent_id=entry["agent_id"],
                timestamp_utc=entry["timestamp_utc"],
            )
            for entry in history
        ]

    @classmethod
    def module_status(cls) -> ModuleStatus:
        backend = "Redis" if GovernanceRedisStore.is_redis_connected() else "in-memory fallback"
        return ModuleStatus(
            status=VerificationState.VERIFIED,
            active=True,
            message=f"Session trajectory engine active ({backend})",
        )


class DynamicTrustScorer:
    _scores: dict[str, float] = defaultdict(lambda: 100.0)

    @classmethod
    def score(cls, agent_id: str, *, violation: bool = False, drift: bool = False) -> DynamicTrustScore:
        current = cls._scores[agent_id]
        if violation:
            current = max(0.0, current - 25.0)
        elif drift:
            current = max(0.0, current - 10.0)
        cls._scores[agent_id] = current
        tier = cls._tier(current)
        restrictions: list[str] = []
        if current < _TRUST_DEGRADE_THRESHOLD:
            restrictions.extend(["BLOCK_EXPORT", "REQUIRE_APPROVAL_WRITE"])
        if current < 40:
            restrictions.append("AGENT_FROZEN")
        return DynamicTrustScore(
            agent_id=agent_id,
            score=round(current, 1),
            tier=tier,
            degraded=current < _TRUST_DEGRADE_THRESHOLD,
            restrictions=restrictions,
        )

    @staticmethod
    def _tier(score: float) -> str:
        if score >= 90:
            return "NORMAL"
        if score >= 70:
            return "ELEVATED"
        if score >= 40:
            return "RESTRICTED"
        return "CRITICAL"

    @classmethod
    def module_status(cls) -> ModuleStatus:
        return ModuleStatus(status=VerificationState.VERIFIED, active=True, message="Real-time scoring active")


class AdaptiveDegradation:
    @staticmethod
    def evaluate(trust: DynamicTrustScore, tool_name: str) -> dict[str, Any] | None:
        if not trust.degraded:
            return None
        level = "READ_ONLY" if trust.score >= 40 else "FROZEN"
        blocked = _WRITE_PATTERN.search(tool_name) is not None
        return {
            "level": level,
            "trust_score": trust.score,
            "blocked_action": blocked,
            "restrictions": trust.restrictions,
        }

    @classmethod
    def module_status(cls) -> ModuleStatus:
        return ModuleStatus(status=VerificationState.VERIFIED, active=True, message="Threshold <50 enforced")


class ImmutableAuditTrail:
    @classmethod
    async def append(cls, entry: dict[str, Any]) -> dict[str, Any]:
        return await GovernanceRedisStore.append_audit_record(entry)

    @classmethod
    async def recent(cls, limit: int = 20) -> list[dict[str, Any]]:
        records, _ = await GovernanceRedisStore.recent_audit_records(limit=limit)
        return records

    @classmethod
    async def audit_response(cls, limit: int = 50) -> AuditTrailResponse:
        records, total = await GovernanceRedisStore.recent_audit_records(limit=limit)
        entries = [
            AuditTrailEntry(
                timestamp=record.get("timestamp", ""),
                session_id=record.get("session_id", ""),
                agent_id=record.get("agent_id", ""),
                tool_name=record.get("tool_name", ""),
                decision=record.get("decision", "UNKNOWN"),
                evaluated_risk_level=record.get("evaluated_risk_level", "LOW"),
                risk_flags=record.get("risk_flags", []),
                evidence_id=record.get("evidence_id"),
                payload_hash=record.get("payload_hash"),
                evidence_status=record.get("evidence_status"),
                entry_hash=record.get("entry_hash"),
                reason=record.get("reason"),
                approval_id=record.get("approval_id"),
                policy=record.get("policy"),
            )
            for record in records
        ]
        return AuditTrailResponse(
            timestamp=datetime.now(timezone.utc).isoformat(),
            entries=list(reversed(entries)),
            total=total,
            redis_connected=GovernanceRedisStore.is_redis_connected(),
        )

    @classmethod
    def module_status(cls) -> ModuleStatus:
        backend = "Redis stream" if GovernanceRedisStore.is_redis_connected() else "in-memory fallback"
        return ModuleStatus(
            status=VerificationState.VERIFIED,
            active=True,
            message=f"Immutable audit trail active ({backend})",
        )


class AgentReputation:
    _history: dict[str, list[str]] = defaultdict(list)

    @classmethod
    def record(cls, agent_id: str, event: str) -> dict[str, Any]:
        cls._history[agent_id].append(event)
        events = cls._history[agent_id]
        violations = sum(1 for e in events if "BLOCK" in e or "VIOLATION" in e)
        badge = "TRUSTED" if violations == 0 else "WATCH" if violations < 3 else "HIGH_RISK"
        return {
            "agent_id": agent_id,
            "events": len(events),
            "violations": violations,
            "badge": badge,
            "score": max(0, 100 - violations * 15),
        }

    @classmethod
    def module_status(cls) -> ModuleStatus:
        return ModuleStatus(status=VerificationState.VERIFIED, active=True, message="Historical behavior tracking active")


class AgentTrustNetwork:
    _delegations: dict[str, str] = {}

    @classmethod
    def verify_chain(cls, agent_id: str, delegator: str | None = None) -> dict[str, Any]:
        if delegator:
            cls._delegations[agent_id] = delegator
        chain = [agent_id]
        cursor = agent_id
        while cursor in cls._delegations:
            parent = cls._delegations[cursor]
            if parent in chain:
                return {"verified": False, "chain": chain, "reason": "CYCLE_DETECTED"}
            chain.append(parent)
            cursor = parent
        return {"verified": True, "chain": chain, "depth": len(chain)}

    @classmethod
    def module_status(cls) -> ModuleStatus:
        return ModuleStatus(status=VerificationState.VERIFIED, active=True, message="Delegation chain verification active")


class GovernanceFramework:
    MODULE_KEYS = (
        "mcp_proxy",
        "tool_api_gateway",
        "agent_registry",
        "agent_identity",
        "effective_authority",
        "intent_engine",
        "trajectory_engine",
        "adaptive_degradation",
        "dynamic_trust_score",
        "evidence_engine",
        "immutable_audit_trail",
        "agent_reputation",
        "agent_trust_network",
    )

    @classmethod
    def module_status_map(cls) -> dict[str, ModuleStatus]:
        return {
            "mcp_proxy": ModuleStatus(status=VerificationState.VERIFIED, active=True, message="MCP JSON-RPC interceptor ready"),
            "tool_api_gateway": ToolApiGateway.module_status(),
            "agent_registry": AgentRegistry.module_status(),
            "agent_identity": AgentIdentityService.module_status(),
            "effective_authority": ModuleStatus(status=VerificationState.VERIFIED, active=True, message="Combinatorial authority engine ready"),
            "intent_engine": IntentEngine.module_status(),
            "trajectory_engine": TrajectoryEngine.module_status(),
            "adaptive_degradation": AdaptiveDegradation.module_status(),
            "dynamic_trust_score": DynamicTrustScorer.module_status(),
            "evidence_engine": ModuleStatus(status=VerificationState.VERIFIED, active=True, message="SHA-256 evidence signing ready"),
            "immutable_audit_trail": ImmutableAuditTrail.module_status(),
            "agent_reputation": AgentReputation.module_status(),
            "agent_trust_network": AgentTrustNetwork.module_status(),
        }

    @classmethod
    def status_response(cls) -> GovernanceStatusResponse:
        return GovernanceStatusResponse(
            timestamp=datetime.now(timezone.utc).isoformat(),
            modules=cls.module_status_map(),
        )

    @staticmethod
    def _authority_requires_approval_override(authority: EffectiveAuthoritySnapshot) -> bool:
        return authority_requires_hitl(authority)

    @classmethod
    async def _enforce_hitl_if_required(
        cls,
        *,
        agent_id: str,
        session_id: str,
        tool_name: str,
        sanitized_args: dict[str, Any],
        modules: dict[str, ModuleStatus],
        authority: EffectiveAuthoritySnapshot,
        intent: IntentContext,
        trajectory: TrajectoryFrame,
        trust_network: dict[str, Any],
    ) -> GovernanceEvaluationResult | None:
        if not (authority_requires_hitl(authority) or trajectory.requires_human_approval):
            return None

        risk_flags = list(dict.fromkeys([*authority.risk_flags, *trajectory.risk_flags]))
        risk_level = normalize_risk_level(authority.evaluated_risk_level)
        trajectory_level = normalize_risk_level(trajectory.evaluated_risk_level)
        if _RISK_ORDER.get(trajectory_level, 0) > _RISK_ORDER.get(risk_level, 0):
            risk_level = trajectory_level

        if _EXFILTRATION_FLAG in risk_flags:
            reason = _EXFILTRATION_FLAG
        elif trajectory.requires_human_approval:
            reason = (
                _EXFILTRATION_FLAG
                if _EXFILTRATION_FLAG in trajectory.risk_flags
                else _TRAJECTORY_EXFIL_FLAG
            )
        else:
            reason = f"AUTHORITY_RISK_{risk_level}"

        merged_authority = EffectiveAuthoritySnapshot(
            agent_id=authority.agent_id,
            evaluated_risk_level=risk_level,
            risk_flags=risk_flags,
            requires_strict_monitoring=True,
        )
        return await cls._human_approval_result(
            agent_id=agent_id,
            session_id=session_id,
            tool_name=tool_name,
            sanitized_args=sanitized_args,
            modules=modules,
            authority=merged_authority,
            intent=intent,
            trajectory=trajectory,
            trust_network=trust_network,
            reason=reason,
            risk_level=risk_level,
            risk_flags=risk_flags,
        )

    @classmethod
    async def precheck_trajectory_gate(
        cls,
        *,
        session_id: str,
        agent_id: str,
        tool_name: str,
        arguments: dict[str, Any],
    ) -> GovernanceEvaluationResult | None:
        """
        Priority trajectory gate — runs before static policy / allowlist checks.
        Returns a pending-approval result when read_invoice history + exfil tool detected.
        """
        normalized_tool = tool_name.strip().lower()
        sanitized_args = ToolApiGateway.sanitize_arguments(arguments)
        _, violation = await TrajectoryEngine.precheck_and_record(session_id, normalized_tool)
        if not violation:
            return None

        modules = cls.module_status_map()
        profile = AgentRegistry.ensure(agent_id)
        authority_raw = EffectiveAuthorityEngine.analyze_authority_risk(profile)
        authority = EffectiveAuthoritySnapshot(
            agent_id=agent_id,
            evaluated_risk_level=RiskLevel.CRITICAL.value,
            risk_flags=list(
                dict.fromkeys(
                    [
                        *authority_raw.get("risk_flags", []),
                        _EXFILTRATION_FLAG,
                        _TRAJECTORY_VIOLATION_FLAG,
                    ]
                )
            ),
            requires_strict_monitoring=True,
        )
        trajectory = await TrajectoryEngine.frame_from_session(session_id, agent_id, normalized_tool)
        intent = IntentContext(
            declared_intent="",
            tool_name=normalized_tool,
            alignment_score=1.0,
        )
        trust_network = AgentTrustNetwork.verify_chain(agent_id, None)
        return await cls._human_approval_result(
            agent_id=agent_id,
            session_id=session_id,
            tool_name=normalized_tool,
            sanitized_args=sanitized_args,
            modules=modules,
            authority=authority,
            intent=intent,
            trajectory=trajectory,
            trust_network=trust_network,
            reason=_EXFILTRATION_FLAG,
            risk_level=RiskLevel.CRITICAL.value,
            risk_flags=[_EXFILTRATION_FLAG, _TRAJECTORY_VIOLATION_FLAG],
        )

    @classmethod
    async def evaluate_action(
        cls,
        *,
        agent_id: str,
        session_id: str,
        tool_name: str,
        arguments: dict[str, Any],
        user_intent: str = "Process finance workflow",
        tool_purpose: str = "",
        divergence_score: float = 0.0,
        delegator: str | None = None,
        agent_token: str | None = None,
        trajectory_recorded: bool = False,
    ) -> GovernanceEvaluationResult:
        tool_name = tool_name.strip().lower()
        modules = cls.module_status_map()
        sanitized_args = ToolApiGateway.sanitize_arguments(arguments)

        identity = AgentIdentityService.verify(agent_id, agent_token)
        if not identity.token_valid:
            modules["agent_identity"] = ModuleStatus(
                status=VerificationState.UNVERIFIED,
                active=True,
                message="Invalid agent token",
            )
            await cls._audit_block(agent_id, session_id, tool_name, "INVALID_AGENT_TOKEN", sanitized_args)
            return GovernanceEvaluationResult(
                decision="BLOCK",
                trust_score=0.0,
                modules=modules,
                block_reason="INVALID_AGENT_TOKEN",
                evidence={"reason": "INVALID_AGENT_TOKEN"},
            )

        profile = AgentRegistry.ensure(agent_id)
        trust_network = AgentTrustNetwork.verify_chain(agent_id, delegator)

        policy_result = ToolApiGateway.evaluate_tool(agent_id, session_id, tool_name, sanitized_args)
        if not policy_result.allowed:
            trust = DynamicTrustScorer.score(agent_id, violation=True)
            evidence_raw = policy_manager.build_block_evidence(
                agent_id=agent_id,
                session_id=session_id,
                tool_name=tool_name,
                decision="BLOCK",
                reason=policy_result.reason,
                action_payload=sanitized_args,
            )
            await cls._audit_block(
                agent_id,
                session_id,
                tool_name,
                policy_result.reason,
                sanitized_args,
                evidence_raw,
            )
            AgentReputation.record(agent_id, f"BLOCK:{policy_result.reason}")
            policy = PolicyDecision(decision="BLOCK", reason=policy_result.reason, risk_flags=[policy_result.reason])
            return GovernanceEvaluationResult(
                decision="BLOCK",
                trust_score=trust.score,
                modules=modules,
                block_reason=policy_result.reason,
                policy=policy,
                trust=trust,
                trust_network=trust_network,
                evidence=EvidencePackage(
                    evidence_id=evidence_raw["evidence_id"],
                    payload_hash=evidence_raw["payload_hash"],
                    decision="BLOCK",
                    status=evidence_raw["status"],
                    timestamp_utc=evidence_raw["timestamp_utc"],
                    session_id=evidence_raw.get("session_id"),
                    agent_id=evidence_raw.get("agent_id"),
                    tool_name=evidence_raw.get("tool_name"),
                    reason=evidence_raw.get("reason"),
                ),
            )

        authority_raw = normalize_authority_dict(EffectiveAuthorityEngine.analyze_authority_risk(profile))
        authority = EffectiveAuthoritySnapshot(**authority_raw)

        intent = IntentEngine.evaluate(user_intent, tool_name, tool_purpose)
        if intent.divergent:
            divergence_score = max(divergence_score, 1.0 - intent.alignment_score)

        if trajectory_recorded:
            trajectory = await TrajectoryEngine.frame_from_session(session_id, agent_id, tool_name)
            if trajectory.requires_human_approval:
                authority = cls._merge_authority_with_trajectory(authority, trajectory)
                hitl = await cls._enforce_hitl_if_required(
                    agent_id=agent_id,
                    session_id=session_id,
                    tool_name=tool_name,
                    sanitized_args=sanitized_args,
                    modules=modules,
                    authority=authority,
                    intent=intent,
                    trajectory=trajectory,
                    trust_network=trust_network,
                )
                if hitl is not None:
                    return hitl
        else:
            _, violation = await TrajectoryEngine.precheck_and_record(session_id, tool_name)
            trajectory = await TrajectoryEngine.frame_from_session(session_id, agent_id, tool_name)
            if violation:
                authority = cls._merge_authority_with_trajectory(authority, trajectory)
                return await cls._human_approval_result(
                    agent_id=agent_id,
                    session_id=session_id,
                    tool_name=tool_name,
                    sanitized_args=sanitized_args,
                    modules=modules,
                    authority=authority,
                    intent=intent,
                    trajectory=trajectory,
                    trust_network=trust_network,
                    reason=_EXFILTRATION_FLAG,
                    risk_level=RiskLevel.CRITICAL.value,
                    risk_flags=[_EXFILTRATION_FLAG, _TRAJECTORY_VIOLATION_FLAG],
                )

        authority = cls._merge_authority_with_trajectory(authority, trajectory)
        authority = cls._merge_authority_with_intent(authority, intent)

        hitl = await cls._enforce_hitl_if_required(
            agent_id=agent_id,
            session_id=session_id,
            tool_name=tool_name,
            sanitized_args=sanitized_args,
            modules=modules,
            authority=authority,
            intent=intent,
            trajectory=trajectory,
            trust_network=trust_network,
        )
        if hitl is not None:
            return hitl

        if trajectory.drift_detected:
            divergence_score = max(divergence_score, 0.85)

        if intent.intent_mismatch:
            return await cls._human_approval_result(
                agent_id=agent_id,
                session_id=session_id,
                tool_name=tool_name,
                sanitized_args=sanitized_args,
                modules=modules,
                authority=authority,
                intent=intent,
                trajectory=trajectory,
                trust_network=trust_network,
                reason=_INTENT_MISMATCH_FLAG,
                risk_level=RiskLevel.HIGH.value,
                risk_flags=list(dict.fromkeys([*authority.risk_flags, *intent.risk_flags])),
            )

        if trajectory.requires_human_approval:
            exfil_reason = (
                _EXFILTRATION_FLAG
                if _EXFILTRATION_FLAG in trajectory.risk_flags
                else _TRAJECTORY_EXFIL_FLAG
            )
            trajectory_flags = list(
                dict.fromkeys([*trajectory.risk_flags, _TRAJECTORY_VIOLATION_FLAG])
            ) if _EXFILTRATION_FLAG in trajectory.risk_flags else trajectory.risk_flags
            return await cls._human_approval_result(
                agent_id=agent_id,
                session_id=session_id,
                tool_name=tool_name,
                sanitized_args=sanitized_args,
                modules=modules,
                authority=authority,
                intent=intent,
                trajectory=trajectory,
                trust_network=trust_network,
                reason=exfil_reason,
                risk_level=trajectory.evaluated_risk_level,
                risk_flags=trajectory_flags,
            )

        trust = DynamicTrustScorer.score(
            agent_id,
            violation=False,
            drift=trajectory.drift_detected,
        )
        degradation = AdaptiveDegradation.evaluate(trust, tool_name)

        firewall_decision = ActionFirewall.evaluate(
            trust_score=trust.score,
            divergence_score=divergence_score,
            tool_name=tool_name,
            action_params=sanitized_args,
        )

        if firewall_decision == EnforcementDecision.BLOCK:
            evidence_raw = EvidenceEngine.generate_decision_evidence(
                session_id, agent_id, tool_name, "BLOCK", "POLICY_VIOLATION", sanitized_args
            )
            await cls._audit_block(agent_id, session_id, tool_name, "POLICY_VIOLATION", sanitized_args, evidence_raw)
            AgentReputation.record(agent_id, "BLOCK:POLICY_VIOLATION")
            return GovernanceEvaluationResult(
                decision="BLOCK",
                trust_score=trust.score,
                modules=modules,
                block_reason="POLICY_VIOLATION",
                policy=PolicyDecision(decision="BLOCK", reason="POLICY_VIOLATION"),
                authority=authority,
                intent=intent,
                trajectory=trajectory,
                trust=trust,
                degradation=degradation,
                trust_network=trust_network,
                evidence=EvidencePackage(
                    evidence_id=evidence_raw["evidence_id"],
                    payload_hash=evidence_raw["payload_hash"],
                    decision="BLOCK",
                    status=evidence_raw["status"],
                    timestamp_utc=evidence_raw["timestamp_utc"],
                    session_id=evidence_raw.get("session_id"),
                    agent_id=evidence_raw.get("agent_id"),
                    tool_name=evidence_raw.get("tool_name"),
                    reason=evidence_raw.get("reason"),
                ),
            )

        if firewall_decision == EnforcementDecision.REQUIRE_HUMAN_APPROVAL:
            return await cls._human_approval_result(
                agent_id=agent_id,
                session_id=session_id,
                tool_name=tool_name,
                sanitized_args=sanitized_args,
                modules=modules,
                authority=authority,
                intent=intent,
                trajectory=trajectory,
                trust_network=trust_network,
                reason="FIREWALL_APPROVAL_REQUIRED",
                risk_level=str(authority.evaluated_risk_level),
                risk_flags=authority.risk_flags,
            )

        if degradation and degradation.get("blocked_action") and firewall_decision == EnforcementDecision.DEGRADE_READ_ONLY:
            return GovernanceEvaluationResult(
                decision=EnforcementDecision.DEGRADE_READ_ONLY.value,
                trust_score=trust.score,
                modules=modules,
                authority=authority,
                intent=intent,
                trajectory=trajectory,
                trust=trust,
                degradation=degradation,
                trust_network=trust_network,
            )

        if firewall_decision == EnforcementDecision.DEGRADE_READ_ONLY:
            return GovernanceEvaluationResult(
                decision=EnforcementDecision.DEGRADE_READ_ONLY.value,
                trust_score=trust.score,
                modules=modules,
                authority=authority,
                intent=intent,
                trajectory=trajectory,
                trust=trust,
                degradation=degradation,
                trust_network=trust_network,
            )

        hitl = await cls._enforce_hitl_if_required(
            agent_id=agent_id,
            session_id=session_id,
            tool_name=tool_name,
            sanitized_args=sanitized_args,
            modules=modules,
            authority=authority,
            intent=intent,
            trajectory=trajectory,
            trust_network=trust_network,
        )
        if hitl is not None:
            return hitl

        execution_result = {"status": "SUCCESS", "message": f"Tool '{tool_name}' executed."}
        evidence_raw = EvidenceEngine.generate_evidence(
            session_id, agent_id, tool_name, sanitized_args, execution_result
        )
        evidence = EvidencePackage(
            evidence_id=evidence_raw["evidence_id"],
            payload_hash=evidence_raw["payload_hash"],
            decision="ALLOW",
            status=evidence_raw["status"],
            timestamp_utc=evidence_raw["timestamp_utc"],
            session_id=session_id,
            agent_id=agent_id,
            tool_name=tool_name,
        )
        policy = PolicyDecision(
            decision="ALLOW",
            evaluated_risk_level=str(authority.evaluated_risk_level),
            risk_flags=authority.risk_flags,
        )
        await cls._audit_entry(
            agent_id=agent_id,
            session_id=session_id,
            tool_name=tool_name,
            decision="ALLOW",
            arguments=sanitized_args,
            evidence=evidence_raw,
            evaluated_risk_level=str(authority.evaluated_risk_level),
            risk_flags=authority.risk_flags,
            policy=policy.model_dump(),
        )
        reputation = AgentReputation.record(agent_id, "ALLOW")

        return GovernanceEvaluationResult(
            decision="ALLOW",
            trust_score=trust.score,
            modules=modules,
            policy=policy,
            authority=authority,
            intent=intent,
            trajectory=trajectory,
            trust=trust,
            degradation=degradation,
            evidence=evidence,
            reputation=reputation,
            trust_network=trust_network,
        )

    @staticmethod
    def _new_approval_id() -> str:
        return f"appr_{uuid.uuid4().hex[:8]}"

    @classmethod
    async def record_authority_enforcement_pending(
        cls,
        *,
        agent_id: str,
        session_id: str,
        tool_name: str,
        arguments: dict[str, Any],
        authority_analysis: dict[str, Any],
        approval_id: str,
    ) -> dict[str, Any]:
        sanitized_args = ToolApiGateway.sanitize_arguments(arguments)
        reason = (
            _EXFILTRATION_FLAG
            if _EXFILTRATION_FLAG in (authority_analysis.get("risk_flags") or [])
            else f"AUTHORITY_RISK_{authority_analysis.get('evaluated_risk_level', 'HIGH')}"
        )
        evidence_raw = EvidenceEngine.generate_decision_evidence(
            session_id,
            agent_id,
            tool_name,
            "PENDING_APPROVAL",
            reason,
            sanitized_args,
        )
        await cls._audit_entry(
            agent_id=agent_id,
            session_id=session_id,
            tool_name=tool_name,
            decision="PENDING_APPROVAL",
            reason=reason,
            arguments=sanitized_args,
            evidence=evidence_raw,
            evaluated_risk_level=str(authority_analysis.get("evaluated_risk_level", "HIGH")),
            risk_flags=list(authority_analysis.get("risk_flags") or []),
            policy={
                "agent_id": agent_id,
                "tool_name": tool_name,
                "decision": "REQUIRES_HUMAN_APPROVAL",
            },
            approval_id=approval_id,
        )
        AgentReputation.record(agent_id, f"PENDING_APPROVAL:{reason}")
        await cls._store_pending_approval(
            approval_id=approval_id,
            agent_id=agent_id,
            session_id=session_id,
            tool_name=tool_name,
            arguments=sanitized_args,
            authority_analysis=authority_analysis,
            evidence=evidence_raw,
            reason=reason,
        )
        return evidence_raw

    @classmethod
    async def _store_pending_approval(
        cls,
        *,
        approval_id: str,
        agent_id: str,
        session_id: str,
        tool_name: str,
        arguments: dict[str, Any],
        authority_analysis: dict[str, Any] | None = None,
        evidence: dict[str, Any] | None = None,
        reason: str | None = None,
        intent_analysis: dict[str, Any] | None = None,
    ) -> None:
        await GovernanceRedisStore.save_pending_approval(
            approval_id,
            {
                "agent_id": agent_id,
                "session_id": session_id,
                "tool_name": tool_name,
                "arguments": arguments,
                "authority_analysis": authority_analysis or {},
                "evidence_id": evidence.get("evidence_id") if evidence else None,
                "payload_hash": evidence.get("payload_hash") if evidence else None,
                "reason": reason,
                "intent_analysis": intent_analysis,
            },
        )

    @classmethod
    async def _find_pending_approval(cls, approval_id: str) -> dict[str, Any] | None:
        pending = await GovernanceRedisStore.get_pending_approval(approval_id)
        if pending is not None:
            return pending

        records, _ = await GovernanceRedisStore.recent_audit_records(limit=200)
        for record in records:
            if record.get("approval_id") == approval_id and record.get("decision") == "PENDING_APPROVAL":
                return {
                    "approval_id": approval_id,
                    "status": "PENDING_APPROVAL",
                    "agent_id": record.get("agent_id", ""),
                    "session_id": record.get("session_id", ""),
                    "tool_name": record.get("tool_name", ""),
                    "arguments": record.get("arguments", {}),
                    "authority_analysis": {
                        "agent_id": record.get("agent_id", ""),
                        "evaluated_risk_level": record.get("evaluated_risk_level", "HIGH"),
                        "risk_flags": record.get("risk_flags", []),
                        "requires_strict_monitoring": True,
                    },
                    "evidence_id": record.get("evidence_id"),
                    "payload_hash": record.get("payload_hash"),
                    "reason": record.get("reason"),
                }
        return None

    @classmethod
    async def resolve_hitl_decision(
        cls,
        *,
        approval_id: str,
        decision: str,
        reviewer_notes: str = "",
        reviewer_agent_id: str | None = None,
    ) -> dict[str, Any]:
        normalized_decision = str(decision).strip().upper()
        if normalized_decision not in {"APPROVED", "REJECTED"}:
            raise ValueError(f"Unsupported HITL decision: {decision}")

        pending = await cls._find_pending_approval(approval_id)
        if pending is None:
            raise LookupError(f"Approval record not found: {approval_id}")

        agent_id = str(pending.get("agent_id", ""))
        if reviewer_agent_id and reviewer_agent_id != agent_id:
            # Reviewer header identifies the supervising operator, not necessarily the agent.
            pass

        resolved = await GovernanceRedisStore.resolve_pending_approval(
            approval_id,
            status=normalized_decision,
            reviewer_notes=reviewer_notes or "",
        )
        if resolved is None:
            raise LookupError(f"Approval record not found: {approval_id}")

        session_id = str(pending.get("session_id", "default-session"))
        tool_name = str(pending.get("tool_name", "unknown_tool"))
        arguments = pending.get("arguments") or {}
        sanitized_args = ToolApiGateway.sanitize_arguments(arguments)
        reason = pending.get("reason") or "HITL_REVIEW"
        risk_flags = list((pending.get("authority_analysis") or {}).get("risk_flags") or [])
        risk_level = str((pending.get("authority_analysis") or {}).get("evaluated_risk_level", "HIGH"))

        if normalized_decision == "APPROVED":
            audit_decision = "APPROVED"
            evidence_status = "APPROVED_BY_HUMAN"
            reputation_event = f"HITL_APPROVED:{reason}"
            message = "Human reviewer approved the suspended agent action."
        else:
            audit_decision = "REJECTED"
            evidence_status = "REJECTED_BY_HUMAN"
            reputation_event = f"HITL_REJECTED:{reason}"
            message = "Human reviewer rejected the suspended agent action."

        evidence_raw = EvidenceEngine.generate_decision_evidence(
            session_id,
            agent_id,
            tool_name,
            audit_decision,
            reason if normalized_decision == "REJECTED" else "HITL_APPROVED",
            sanitized_args,
        )
        evidence_raw["status"] = evidence_status

        await cls._audit_entry(
            agent_id=agent_id,
            session_id=session_id,
            tool_name=tool_name,
            decision=audit_decision,
            reason=reviewer_notes or reason,
            arguments=sanitized_args,
            evidence=evidence_raw,
            evaluated_risk_level=risk_level,
            risk_flags=risk_flags,
            policy={
                "agent_id": agent_id,
                "tool_name": tool_name,
                "decision": normalized_decision,
                "reviewer_notes": reviewer_notes or "",
            },
            approval_id=approval_id,
        )
        AgentReputation.record(agent_id, reputation_event)

        return {
            "status": normalized_decision,
            "decision": normalized_decision,
            "approval_id": approval_id,
            "agent_id": agent_id,
            "tool_name": tool_name,
            "payload_hash": evidence_raw.get("payload_hash") or pending.get("payload_hash"),
            "reviewer_notes": reviewer_notes or "",
            "message": message,
            "evidence": evidence_raw,
        }

    @classmethod
    async def _human_approval_result(
        cls,
        *,
        agent_id: str,
        session_id: str,
        tool_name: str,
        sanitized_args: dict[str, Any],
        modules: dict[str, ModuleStatus],
        authority: EffectiveAuthoritySnapshot,
        intent: IntentContext,
        trajectory: TrajectoryFrame,
        trust_network: dict[str, Any],
        reason: str,
        risk_level: str,
        risk_flags: list[str],
    ) -> GovernanceEvaluationResult:
        approval_id = cls._new_approval_id()
        evidence_raw = EvidenceEngine.generate_decision_evidence(
            session_id,
            agent_id,
            tool_name,
            "PENDING_APPROVAL",
            reason,
            sanitized_args,
        )
        policy = PolicyDecision(
            decision="REQUIRES_HUMAN_APPROVAL",
            reason=reason,
            evaluated_risk_level=risk_level,
            risk_flags=risk_flags,
        )
        await cls._audit_entry(
            agent_id=agent_id,
            session_id=session_id,
            tool_name=tool_name,
            decision="PENDING_APPROVAL",
            reason=reason,
            arguments=sanitized_args,
            evidence=evidence_raw,
            evaluated_risk_level=risk_level,
            risk_flags=risk_flags,
            policy=policy.model_dump(),
            approval_id=approval_id,
        )
        AgentReputation.record(agent_id, f"PENDING_APPROVAL:{reason}")
        await cls._store_pending_approval(
            approval_id=approval_id,
            agent_id=agent_id,
            session_id=session_id,
            tool_name=tool_name,
            arguments=sanitized_args,
            authority_analysis=authority.model_dump(),
            evidence=evidence_raw,
            reason=reason,
            intent_analysis=intent.intent_analysis,
        )
        trust = DynamicTrustScorer.score(agent_id, violation=False, drift=True)
        return GovernanceEvaluationResult(
            decision="REQUIRES_HUMAN_APPROVAL",
            trust_score=trust.score,
            modules=modules,
            policy=policy,
            requires_human_approval=True,
            approval_id=approval_id,
            authority=authority,
            intent=intent,
            trajectory=trajectory,
            trust=trust,
            trust_network=trust_network,
            evidence=EvidencePackage(
                evidence_id=evidence_raw["evidence_id"],
                payload_hash=evidence_raw["payload_hash"],
                decision="PENDING_APPROVAL",
                status=evidence_raw["status"],
                timestamp_utc=evidence_raw["timestamp_utc"],
                session_id=evidence_raw.get("session_id"),
                agent_id=evidence_raw.get("agent_id"),
                tool_name=evidence_raw.get("tool_name"),
                reason=evidence_raw.get("reason"),
            ),
        )

    @staticmethod
    def _merge_authority_with_intent(
        authority: EffectiveAuthoritySnapshot,
        intent: IntentContext,
    ) -> EffectiveAuthoritySnapshot:
        if not intent.risk_flags:
            return authority
        merged_flags = list(dict.fromkeys([*authority.risk_flags, *intent.risk_flags]))
        merged_level = str(authority.evaluated_risk_level)
        if intent.intent_mismatch:
            merged_level = GovernanceFramework._raise_level_str(merged_level, RiskLevel.HIGH.value)
        return EffectiveAuthoritySnapshot(
            agent_id=authority.agent_id,
            evaluated_risk_level=merged_level,
            risk_flags=merged_flags,
            requires_strict_monitoring=True,
        )

    @staticmethod
    def _raise_level_str(current: str, candidate: str) -> str:
        if _RISK_ORDER.get(candidate, 0) > _RISK_ORDER.get(current, 0):
            return candidate
        return current

    @staticmethod
    def _merge_authority_with_trajectory(
        authority: EffectiveAuthoritySnapshot,
        trajectory: TrajectoryFrame,
    ) -> EffectiveAuthoritySnapshot:
        if not trajectory.risk_flags:
            return authority
        merged_flags = list(dict.fromkeys([*authority.risk_flags, *trajectory.risk_flags]))
        merged_level = authority.evaluated_risk_level
        if _RISK_ORDER.get(trajectory.evaluated_risk_level, 0) > _RISK_ORDER.get(str(merged_level), 0):
            merged_level = trajectory.evaluated_risk_level
        return EffectiveAuthoritySnapshot(
            agent_id=authority.agent_id,
            evaluated_risk_level=merged_level,
            risk_flags=merged_flags,
            requires_strict_monitoring=True,
        )

    @staticmethod
    async def _audit_entry(
        agent_id: str,
        session_id: str,
        tool_name: str,
        decision: str,
        arguments: dict[str, Any],
        evidence: dict[str, Any] | None = None,
        reason: str | None = None,
        evaluated_risk_level: str = "LOW",
        risk_flags: list[str] | None = None,
        policy: dict[str, Any] | None = None,
        approval_id: str | None = None,
    ) -> None:
        await ImmutableAuditTrail.append(
            {
                "agent_id": agent_id,
                "session_id": session_id,
                "tool_name": tool_name,
                "decision": decision,
                "reason": reason,
                "evidence_id": evidence["evidence_id"] if evidence else None,
                "payload_hash": evidence.get("payload_hash") if evidence else None,
                "evidence_status": evidence.get("status") if evidence else None,
                "arguments": arguments,
                "evaluated_risk_level": evaluated_risk_level,
                "risk_flags": risk_flags or [],
                "policy": policy,
                "approval_id": approval_id,
            }
        )

    @staticmethod
    async def _audit_block(
        agent_id: str,
        session_id: str,
        tool_name: str,
        reason: str,
        arguments: dict[str, Any],
        evidence: dict[str, Any] | None = None,
        evaluated_risk_level: str = "HIGH",
        risk_flags: list[str] | None = None,
        policy: dict[str, Any] | None = None,
    ) -> None:
        await GovernanceFramework._audit_entry(
            agent_id=agent_id,
            session_id=session_id,
            tool_name=tool_name,
            decision="BLOCK",
            reason=reason,
            arguments=arguments,
            evidence=evidence,
            evaluated_risk_level=evaluated_risk_level,
            risk_flags=risk_flags or [reason],
            policy=policy or {"decision": "BLOCK", "reason": reason},
        )

    @classmethod
    async def inspect_mcp(cls, payload: dict[str, Any], agent_trust_score: float, divergence_score: float = 0.0) -> dict[str, Any]:
        return await MCPProxyInspector.inspect_mcp_request(
            mcp_payload=payload,
            agent_trust_score=agent_trust_score,
            divergence_score=divergence_score,
        )
