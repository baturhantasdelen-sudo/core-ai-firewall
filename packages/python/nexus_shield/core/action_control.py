"""Action Control Plane — identity, authority, intent, policy, and risk routing."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal

from nexus_shield.core.outcome_verifier import resolve_consequential_action
from nexus_shield.core.passport import AgentPassportRecord, PassportError, validate_passport_action
from nexus_shield.core.aar import AARSigningKeyPair
from nexus_shield.core.delegation import DelegationGraph

AutonomyRoute = Literal["AUTO", "VERIFY", "HUMAN", "BLOCK"]
RiskBand = Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]


def classify_risk_band(risk_score: float) -> RiskBand:
    if risk_score >= 0.9:
        return "CRITICAL"
    if risk_score >= 0.7:
        return "HIGH"
    if risk_score >= 0.35:
        return "MEDIUM"
    return "LOW"


def route_autonomy(risk_score: float) -> AutonomyRoute:
    band = classify_risk_band(risk_score)
    if band == "LOW":
        return "AUTO"
    if band == "MEDIUM":
        return "VERIFY"
    if band == "HIGH":
        return "HUMAN"
    return "BLOCK"


@dataclass(frozen=True)
class ActionControlDecision:
    allowed: bool
    autonomy_route: AutonomyRoute
    risk_band: RiskBand
    risk_score: float
    reason: str | None = None
    details: dict[str, Any] | None = None


def evaluate_action_control(
    *,
    passport: AgentPassportRecord,
    intent: dict[str, Any],
    required_scopes: list[str],
    amount: float | None,
    signing_key: AARSigningKeyPair | None,
    delegation_graph: DelegationGraph | None,
    risk_score: float,
    revoked_passport_ids: set[str] | None = None,
) -> ActionControlDecision:
    """Runtime pipeline: Identity → Authority → Intent → Policy → Risk."""
    revoked = revoked_passport_ids or set()
    if passport.passport_id in revoked:
        return ActionControlDecision(
            allowed=False,
            autonomy_route="BLOCK",
            risk_band="CRITICAL",
            risk_score=max(risk_score, 0.95),
            reason="passport revoked by circuit breaker",
        )

    try:
        validate_passport_action(
            passport,
            required_scopes=required_scopes,
            amount=amount,
            signing_key=signing_key,
        )
    except PassportError as exc:
        return ActionControlDecision(
            allowed=False,
            autonomy_route="BLOCK",
            risk_band=classify_risk_band(max(risk_score, 0.85)),
            risk_score=max(risk_score, 0.85),
            reason=str(exc),
        )

    parsed_intent = str(intent.get("parsed_intent") or "")
    target = str(intent.get("target_resource") or "").strip()
    consequential = resolve_consequential_action(parsed_intent)
    if consequential is not None and not target:
        return ActionControlDecision(
            allowed=False,
            autonomy_route="BLOCK",
            risk_band="HIGH",
            risk_score=max(risk_score, 0.75),
            reason="consequential action requires target_resource",
            details={"consequential_action": consequential.value},
        )

    if delegation_graph is not None:
        delegation = delegation_graph.validate_action(
            passport.identity,
            required_scopes=required_scopes,
            amount=amount,
        )
        if not delegation.get("allowed"):
            return ActionControlDecision(
                allowed=False,
                autonomy_route="BLOCK",
                risk_band="HIGH",
                risk_score=max(risk_score, 0.8),
                reason=str(delegation.get("reason", "delegation denied")),
                details=delegation,
            )

    autonomy = route_autonomy(risk_score)
    if autonomy == "BLOCK":
        return ActionControlDecision(
            allowed=False,
            autonomy_route="BLOCK",
            risk_band=classify_risk_band(risk_score),
            risk_score=risk_score,
            reason="risk score exceeds autonomous execution threshold",
        )

    return ActionControlDecision(
        allowed=True,
        autonomy_route=autonomy,
        risk_band=classify_risk_band(risk_score),
        risk_score=risk_score,
    )
