from __future__ import annotations

from enum import Enum
from typing import Any


class EnforcementDecision(str, Enum):
    ALLOW = "ALLOW"
    BLOCK = "BLOCK"
    DEGRADE_READ_ONLY = "DEGRADE_READ_ONLY"
    REQUIRE_HUMAN_APPROVAL = "REQUIRE_HUMAN_APPROVAL"


_WRITE_VERBS: tuple[str, ...] = ("write", "delete", "post", "pay", "update")
_HIGH_VALUE_PAYMENT_TOOLS: frozenset[str] = frozenset({"create_payment", "execute_transfer"})


class ActionFirewall:
    """Agent yetkisi, dinamik güven skoru ve eylem riskine göre nihai kararı verir."""

    @staticmethod
    def evaluate(
        trust_score: float,
        divergence_score: float,
        tool_name: str,
        action_params: dict[str, Any],
    ) -> EnforcementDecision:
        if divergence_score > 0.80:
            return EnforcementDecision.BLOCK

        if trust_score < 50.0:
            lowered = tool_name.lower()
            if any(verb in lowered for verb in _WRITE_VERBS):
                return EnforcementDecision.DEGRADE_READ_ONLY

        if tool_name in _HIGH_VALUE_PAYMENT_TOOLS:
            amount = action_params.get("amount", 0)
            if isinstance(amount, (int, float)) and amount > 1000:
                return EnforcementDecision.REQUIRE_HUMAN_APPROVAL

        return EnforcementDecision.ALLOW
