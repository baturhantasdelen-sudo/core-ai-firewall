"""False-success interception — HTTP 200 vs authoritative DB/ledger state."""

from __future__ import annotations

from typing import Any

from nexus_shield.accountability.context import get_accountability_context
from nexus_shield.core.outcome_verifier import OutcomeVerifier, OutcomeVerdict


class FalseSuccessInterceptor:
    """Compare API success responses against live state connectors."""

    def __init__(self, engine: OutcomeVerifier | None = None) -> None:
        ctx = get_accountability_context()
        if engine is not None:
            self._engine = engine
        elif ctx.verification_engine is not None:
            self._engine = ctx.verification_engine
        else:
            raise RuntimeError("OutcomeVerifier is not configured on AccountabilityContext")

    def evaluate(
        self,
        *,
        intent: dict[str, Any],
        execution_result: dict[str, Any],
        state_snapshot_before: dict[str, Any],
    ) -> tuple[OutcomeVerdict, dict[str, Any]]:
        verdict, payload = self._engine.verify_action_outcome(
            intent,
            execution_result,
            state_snapshot_before,
        )
        ctx = get_accountability_context()
        if verdict == "UNVERIFIED":
            ctx.store.add_incident(
                code="FALSE_SUCCESS",
                message="API returned success but DB/ledger state did not transition as expected",
                severity="CRITICAL",
                metadata={
                    "intent": intent,
                    "execution_result": execution_result,
                    "verification": payload,
                },
            )
        return verdict, payload


def intercept_and_log_outcome(
    *,
    intent: dict[str, Any],
    execution_result: dict[str, Any],
    state_snapshot_before: dict[str, Any],
    passport_id: str | None = None,
    agent_id: str | None = None,
) -> tuple[OutcomeVerdict, dict[str, Any]]:
    interceptor = FalseSuccessInterceptor()
    verdict, payload = interceptor.evaluate(
        intent=intent,
        execution_result=execution_result,
        state_snapshot_before=state_snapshot_before,
    )
    if verdict == "UNVERIFIED" and passport_id and agent_id:
        ctx = get_accountability_context()
        if ctx.circuit_breaker is not None:
            trip = ctx.circuit_breaker.trip(
                reason="UNVERIFIED_OUTCOME",
                passport_id=passport_id,
                agent_id=agent_id,
                delegation_graph=ctx.delegation_graph,
                metadata={"verification": payload},
            )
            ctx.store.append_audit(trip)
    return verdict, payload
