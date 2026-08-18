from __future__ import annotations

import fnmatch
import json
import logging
import os
import time
from collections import defaultdict, deque
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from nexus_governance.nexus_evidence_engine import EvidenceEngine

logger = logging.getLogger("nexus.policy")

POLICY_VIOLATION_REASON = "POLICY_VIOLATION"
DLP_VIOLATION_REASON = "DLP_VIOLATION"
RATE_LIMIT_REASON = "RATE_LIMIT_EXCEEDED"
_DLP_TOOL_HINTS: tuple[str, ...] = ("pii", "export", "exfil", "dump")


@dataclass(frozen=True)
class RateLimitConfig:
    requests_per_minute: int = 60
    scope: str = "session_agent"


@dataclass(frozen=True)
class DlpConfig:
    blocked_tools: tuple[str, ...] = ()
    sensitive_tool_patterns: tuple[str, ...] = ()


@dataclass(frozen=True)
class AgentPolicy:
    agent_id: str
    allowed_tools: frozenset[str] = frozenset()
    blocked_tools: frozenset[str] = frozenset()
    rate_limit: RateLimitConfig = field(default_factory=RateLimitConfig)
    dlp: DlpConfig = field(default_factory=DlpConfig)


@dataclass(frozen=True)
class PolicyEvaluationResult:
    allowed: bool
    decision: str
    reason: str
    dlp_violation: bool = False
    rate_limit_violation: bool = False


class PolicyManager:
    """Loads agent guardrails from config/policies.json and evaluates tool requests."""

    def __init__(self, policy_path: Path | None = None) -> None:
        self._policy_path = policy_path or self._resolve_policy_path()
        self._agents: dict[str, AgentPolicy] = {}
        self._default_policy = AgentPolicy(agent_id="default")
        self._rate_windows: dict[str, deque[float]] = defaultdict(deque)
        self.reload()

    @staticmethod
    def _resolve_policy_path() -> Path:
        env_path = os.getenv("NEXUS_POLICIES_PATH")
        if env_path:
            return Path(env_path)
        candidates = (
            Path("/opt/nexus-core-firewall/config/policies.json"),
            Path(__file__).resolve().parent.parent / "config" / "policies.json",
        )
        for candidate in candidates:
            if candidate.is_file():
                return candidate
        return candidates[-1]

    def reload(self) -> None:
        if not self._policy_path.is_file():
            logger.error("Policy file not found: %s — using empty default policy", self._policy_path)
            self._agents = {}
            self._default_policy = AgentPolicy(agent_id="default")
            return

        with self._policy_path.open(encoding="utf-8") as handle:
            raw = json.load(handle)

        self._default_policy = self._parse_agent_policy("default", raw.get("default", {}))
        agent_configs = raw.get("policies") or raw.get("agents") or {}
        self._agents = {
            agent_id: self._parse_agent_policy(agent_id, config)
            for agent_id, config in agent_configs.items()
        }
        logger.info(
            "Loaded policies from %s (%d agent profiles)",
            self._policy_path,
            len(self._agents),
        )

    @staticmethod
    def _parse_rate_limit(config: dict[str, Any]) -> RateLimitConfig:
        rate_raw = config.get("rate_limit", {})
        per_min = config.get("rate_limit_per_min")
        if per_min is None and isinstance(rate_raw, dict):
            per_min = rate_raw.get("requests_per_minute", 60)
        scope = "session_agent"
        if isinstance(rate_raw, dict) and rate_raw.get("scope"):
            scope = str(rate_raw["scope"])
        return RateLimitConfig(
            requests_per_minute=int(per_min if per_min is not None else 60),
            scope=scope,
        )

    @staticmethod
    def _parse_agent_policy(agent_id: str, config: dict[str, Any]) -> AgentPolicy:
        dlp_raw = config.get("dlp", {})
        blocked = frozenset(config.get("blocked_tools", []))
        dlp_blocked = tuple(dlp_raw.get("blocked_tools", [])) or tuple(
            tool for tool in blocked if PolicyManager._is_dlp_tool_name(tool)
        )
        return AgentPolicy(
            agent_id=agent_id,
            allowed_tools=frozenset(config.get("allowed_tools", [])),
            blocked_tools=blocked,
            rate_limit=PolicyManager._parse_rate_limit(config),
            dlp=DlpConfig(
                blocked_tools=dlp_blocked,
                sensitive_tool_patterns=tuple(
                    dlp_raw.get(
                        "sensitive_tool_patterns",
                        ["export_*pii*", "*customer_pii*", "dump_*_data"],
                    )
                ),
            ),
        )

    @staticmethod
    def _is_dlp_tool_name(tool_name: str) -> bool:
        lowered = tool_name.lower()
        return any(hint in lowered for hint in _DLP_TOOL_HINTS)

    def get_policy(self, agent_id: str) -> AgentPolicy:
        return self._agents.get(agent_id, self._default_policy)

    def _rate_key(self, agent_id: str, session_id: str, policy: AgentPolicy) -> str:
        if policy.rate_limit.scope == "session_agent":
            return f"{agent_id}:{session_id}"
        return agent_id

    def _check_rate_limit(self, agent_id: str, session_id: str, policy: AgentPolicy) -> bool:
        limit = policy.rate_limit.requests_per_minute
        if limit <= 0:
            return True

        key = self._rate_key(agent_id, session_id, policy)
        now = time.monotonic()
        window = self._rate_windows[key]

        while window and now - window[0] > 60.0:
            window.popleft()

        if len(window) >= limit:
            logger.warning(
                "Rate limit exceeded agent=%s session=%s count=%d limit=%d",
                agent_id,
                session_id,
                len(window),
                limit,
            )
            return False

        window.append(now)
        return True

    @staticmethod
    def _matches_dlp(tool_name: str, dlp: DlpConfig) -> bool:
        if tool_name in dlp.blocked_tools:
            return True
        lowered = tool_name.lower()
        for pattern in dlp.sensitive_tool_patterns:
            if fnmatch.fnmatch(lowered, pattern.lower()):
                return True
        return False

    def evaluate_tool(
        self,
        agent_id: str,
        session_id: str,
        tool_name: str,
    ) -> PolicyEvaluationResult:
        policy = self.get_policy(agent_id)

        if not self._check_rate_limit(agent_id, session_id, policy):
            return PolicyEvaluationResult(
                allowed=False,
                decision="BLOCK",
                reason=RATE_LIMIT_REASON,
                rate_limit_violation=True,
            )

        if self._matches_dlp(tool_name, policy.dlp) or tool_name in policy.blocked_tools:
            logger.warning(
                "DLP/policy block agent=%s session=%s tool=%s",
                agent_id,
                session_id,
                tool_name,
            )
            dlp_hit = self._matches_dlp(tool_name, policy.dlp) or (
                tool_name in policy.blocked_tools and self._is_dlp_tool_name(tool_name)
            )
            reason = DLP_VIOLATION_REASON if dlp_hit else POLICY_VIOLATION_REASON
            return PolicyEvaluationResult(
                allowed=False,
                decision="BLOCK",
                reason=reason,
                dlp_violation=dlp_hit,
            )

        if policy.allowed_tools and tool_name not in policy.allowed_tools:
            logger.warning(
                "Allowlist violation agent=%s session=%s tool=%s allowed=%s",
                agent_id,
                session_id,
                tool_name,
                sorted(policy.allowed_tools),
            )
            return PolicyEvaluationResult(
                allowed=False,
                decision="BLOCK",
                reason=POLICY_VIOLATION_REASON,
            )

        logger.info("Policy allow agent=%s session=%s tool=%s", agent_id, session_id, tool_name)
        return PolicyEvaluationResult(allowed=True, decision="ALLOW", reason="POLICY_ALLOW")

    def build_block_evidence(
        self,
        *,
        agent_id: str,
        session_id: str,
        tool_name: str,
        decision: str,
        reason: str,
        action_payload: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        return EvidenceEngine.generate_decision_evidence(
            session_id=session_id,
            agent_id=agent_id,
            tool_name=tool_name,
            decision=decision,
            reason=reason,
            action_payload=action_payload or {},
        )


# Singleton for request handlers; tests may replace via policy_manager fixture.
policy_manager = PolicyManager()
