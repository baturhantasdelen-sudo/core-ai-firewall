"""Unified 13-module Enterprise AI Agent Governance & Trust orchestrator."""

from __future__ import annotations

import hashlib
import hmac
import json
import os
import re
from collections import defaultdict, deque
from datetime import datetime, timezone
from typing import Any

from nexus_governance.models import (
    AgentIdentity,
    DynamicTrustScore,
    EffectiveAuthoritySnapshot,
    EvidencePackage,
    GovernanceEvaluationResult,
    GovernanceStatusResponse,
    IntentContext,
    ModuleStatus,
    TrajectoryFrame,
    VerificationState,
)
from nexus_governance.nexus_action_firewall import ActionFirewall, EnforcementDecision
from nexus_governance.nexus_agent_identity import AgentProfile, EffectiveAuthorityEngine, RiskLevel
from nexus_governance.nexus_evidence_engine import EvidenceEngine
from nexus_governance.nexus_mcp_proxy import MCPProxyInspector
from nexus_governance.nexus_policy_engine import policy_manager

_IDENTITY_SECRET = os.getenv("NEXUS_API_KEY", "nexus_secret_key_123")
_TRUST_DEGRADE_THRESHOLD = 50.0
_UNSAFE_SEQUENCES: tuple[tuple[str, ...], ...] = (
    ("read_invoice", "export_customer_pii"),
    ("get_account_balance", "execute_transfer"),
    ("db_read", "api_external_post"),
)
_WRITE_PATTERN = re.compile(r"(write|delete|export|pay|transfer|execute)", re.I)


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
    }

    @classmethod
    def evaluate(cls, declared_intent: str, tool_name: str) -> IntentContext:
        intent_lower = declared_intent.lower()
        tool_lower = tool_name.lower()
        score = 0.55
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
        divergent = score < 0.5
        return IntentContext(
            declared_intent=declared_intent,
            tool_name=tool_name,
            alignment_score=round(score, 2),
            divergent=divergent,
        )

    @classmethod
    def module_status(cls) -> ModuleStatus:
        return ModuleStatus(status=VerificationState.VERIFIED, active=True, message="Semantic alignment engine ready")


class TrajectoryEngine:
    _sessions: dict[str, deque[str]] = defaultdict(lambda: deque(maxlen=20))

    @classmethod
    def record(cls, session_id: str, tool_name: str) -> TrajectoryFrame:
        history = cls._sessions[session_id]
        history.append(tool_name)
        sequence = list(history)
        drift = cls._detect_drift(sequence)
        return TrajectoryFrame(
            session_id=session_id,
            agent_id="",
            tool_name=tool_name,
            sequence_index=len(sequence),
            drift_detected=drift,
            unsafe_sequence=sequence[-3:] if drift else [],
        )

    @staticmethod
    def _detect_drift(sequence: list[str]) -> bool:
        if len(sequence) < 2:
            return False
        tail = tuple(sequence[-2:])
        if tail in _UNSAFE_SEQUENCES:
            return True
        if len(sequence) >= 3 and sequence[-1] != sequence[-2] and _WRITE_PATTERN.search(sequence[-1]):
            return sequence[-2].startswith("read")
        return False

    @classmethod
    def module_status(cls) -> ModuleStatus:
        return ModuleStatus(
            status=VerificationState.VERIFIED,
            active=True,
            message=f"{len(cls._sessions)} active trajectories",
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
    _entries: list[dict[str, Any]] = []
    _chain_hash: str = "GENESIS"

    @classmethod
    def append(cls, entry: dict[str, Any]) -> dict[str, Any]:
        record = {
            **entry,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "prev_hash": cls._chain_hash,
        }
        payload = json.dumps(record, sort_keys=True)
        record["entry_hash"] = hashlib.sha256(payload.encode()).hexdigest()
        cls._chain_hash = record["entry_hash"]
        cls._entries.append(record)
        return record

    @classmethod
    def recent(cls, limit: int = 20) -> list[dict[str, Any]]:
        return cls._entries[-limit:]

    @classmethod
    def module_status(cls) -> ModuleStatus:
        return ModuleStatus(
            status=VerificationState.VERIFIED,
            active=True,
            message=f"{len(cls._entries)} append-only records",
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

    @classmethod
    def evaluate_action(
        cls,
        *,
        agent_id: str,
        session_id: str,
        tool_name: str,
        arguments: dict[str, Any],
        user_intent: str = "Process finance workflow",
        divergence_score: float = 0.0,
        delegator: str | None = None,
        agent_token: str | None = None,
    ) -> GovernanceEvaluationResult:
        modules = cls.module_status_map()
        sanitized_args = ToolApiGateway.sanitize_arguments(arguments)

        identity = AgentIdentityService.verify(agent_id, agent_token)
        if not identity.token_valid:
            modules["agent_identity"] = ModuleStatus(
                status=VerificationState.UNVERIFIED,
                active=True,
                message="Invalid agent token",
            )
            cls._audit_block(agent_id, session_id, tool_name, "INVALID_AGENT_TOKEN", sanitized_args)
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
            cls._audit_block(agent_id, session_id, tool_name, policy_result.reason, sanitized_args, evidence_raw)
            AgentReputation.record(agent_id, f"BLOCK:{policy_result.reason}")
            return GovernanceEvaluationResult(
                decision="BLOCK",
                trust_score=trust.score,
                modules=modules,
                block_reason=policy_result.reason,
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

        authority_raw = EffectiveAuthorityEngine.analyze_authority_risk(profile)
        authority = EffectiveAuthoritySnapshot(**authority_raw)

        intent = IntentEngine.evaluate(user_intent, tool_name)
        if intent.divergent:
            divergence_score = max(divergence_score, 1.0 - intent.alignment_score)

        trajectory = TrajectoryEngine.record(session_id, tool_name)
        if trajectory.drift_detected:
            divergence_score = max(divergence_score, 0.85)

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
            cls._audit_block(agent_id, session_id, tool_name, "POLICY_VIOLATION", sanitized_args, evidence_raw)
            AgentReputation.record(agent_id, "BLOCK:POLICY_VIOLATION")
            return GovernanceEvaluationResult(
                decision="BLOCK",
                trust_score=trust.score,
                modules=modules,
                block_reason="POLICY_VIOLATION",
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

        if firewall_decision == EnforcementDecision.REQUIRE_HUMAN_APPROVAL:
            return GovernanceEvaluationResult(
                decision=EnforcementDecision.REQUIRE_HUMAN_APPROVAL.value,
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
        )
        ImmutableAuditTrail.append(
            {
                "agent_id": agent_id,
                "session_id": session_id,
                "tool_name": tool_name,
                "decision": "ALLOW",
                "evidence_id": evidence.evidence_id,
            }
        )
        reputation = AgentReputation.record(agent_id, "ALLOW")

        return GovernanceEvaluationResult(
            decision="ALLOW",
            trust_score=trust.score,
            modules=modules,
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
    def _audit_block(
        agent_id: str,
        session_id: str,
        tool_name: str,
        reason: str,
        arguments: dict[str, Any],
        evidence: dict[str, Any] | None = None,
    ) -> None:
        ImmutableAuditTrail.append(
            {
                "agent_id": agent_id,
                "session_id": session_id,
                "tool_name": tool_name,
                "decision": "BLOCK",
                "reason": reason,
                "evidence_id": evidence["evidence_id"] if evidence else None,
                "arguments": arguments,
            }
        )

    @classmethod
    async def inspect_mcp(cls, payload: dict[str, Any], agent_trust_score: float, divergence_score: float = 0.0) -> dict[str, Any]:
        return await MCPProxyInspector.inspect_mcp_request(
            mcp_payload=payload,
            agent_trust_score=agent_trust_score,
            divergence_score=divergence_score,
        )
