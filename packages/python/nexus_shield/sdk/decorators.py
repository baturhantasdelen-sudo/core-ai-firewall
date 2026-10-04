"""@secure_agent_action — passport validation, execution, verification, AAR sealing."""

from __future__ import annotations

import functools
import inspect
from typing import Any, Callable, TypeVar

from nexus_shield.accountability.context import get_accountability_context
from nexus_shield.core.action_control import evaluate_action_control, route_autonomy
from nexus_shield.core.aar import (
    AgentReceiptBlock,
    ApiResponseBlock,
    AuthorityBlock,
    ExecutionBlock,
    IntentBlock,
    PolicyBlock,
    build_outcome_verification_block,
)
from nexus_shield.sdk.interceptor import intercept_and_log_outcome

F = TypeVar("F", bound=Callable[..., Any])


class SecureActionError(RuntimeError):
    """Passport or accountability pipeline failure."""


def run_secure_agent_action(
    passport_id: str,
    required_scopes: list[str],
    handler: Callable[..., dict[str, Any]],
    *,
    parsed_intent: str = "EXECUTE_PAYMENT",
    target_resource_key: str = "target_resource",
    policy_id: str | None = None,
    **handler_kwargs: Any,
) -> dict[str, Any]:
    ctx = get_accountability_context()
    passport = ctx.get_passport(passport_id)
    if passport is None:
        raise SecureActionError(f"unknown passport_id: {passport_id}")

    amount = handler_kwargs.get("amount")
    if amount is not None:
        amount = float(amount)

    state_before = dict(handler_kwargs.get("state_snapshot_before") or {})
    raw_prompt = str(handler_kwargs.get("raw_prompt") or "")
    target_resource = str(handler_kwargs.get(target_resource_key) or handler_kwargs.get("target_resource") or "")
    intent_preview = {
        "raw_prompt": raw_prompt,
        "parsed_intent": parsed_intent,
        "target_resource": target_resource,
    }
    preliminary_risk = 0.15 if parsed_intent == "EXECUTE_PAYMENT" else 0.4
    control = evaluate_action_control(
        passport=passport,
        intent=intent_preview,
        required_scopes=required_scopes,
        amount=amount,
        signing_key=ctx.signing_key,
        delegation_graph=ctx.delegation_graph,
        risk_score=preliminary_risk,
        revoked_passport_ids=ctx.circuit_breaker.state.revoked_passport_ids if ctx.circuit_breaker else None,
    )
    if not control.allowed:
        if ctx.circuit_breaker is not None:
            ctx.circuit_breaker.trip(
                reason="POLICY_VIOLATION",
                passport_id=passport.passport_id,
                agent_id=passport.identity,
                delegation_graph=ctx.delegation_graph,
                metadata={"reason": control.reason, "details": control.details},
            )
        raise SecureActionError(control.reason or "action control denied")

    graph = ctx.delegation_graph
    tool_called = str(handler_kwargs.get("tool_called") or handler.__name__)
    request_payload = dict(handler_kwargs.get("request_payload") or {})

    result = handler(**handler_kwargs)
    if not isinstance(result, dict):
        raise SecureActionError("secure agent handlers must return a dict with execution metadata")

    status_code = int(result.get("status_code", 200))
    raw_body = str(result.get("raw_body", "{}"))
    execution_result = {"status_code": status_code, "raw_body": raw_body}
    intent = {
        "raw_prompt": raw_prompt,
        "parsed_intent": parsed_intent,
        "target_resource": target_resource,
    }

    verdict, verification_payload = intercept_and_log_outcome(
        intent=intent,
        execution_result=execution_result,
        state_snapshot_before=state_before,
        passport_id=passport.passport_id,
        agent_id=passport.identity,
    )

    policy_eval = "ALLOW" if verdict == "VERIFIED" else "REQUIRE_APPROVAL"
    risk_score = 0.12 if verdict == "VERIFIED" else 0.82
    autonomy = route_autonomy(risk_score)
    if autonomy == "BLOCK" and verdict != "VERIFIED":
        policy_eval = "BLOCK"

    receipt = ctx.aar_engine.seal(
        agent=AgentReceiptBlock(
            identity=passport.identity,
            passport_id=passport.passport_id,
            owner=passport.owner,
        ),
        intent=IntentBlock(
            raw_prompt=raw_prompt or parsed_intent,
            parsed_intent=parsed_intent,
            target_resource=target_resource or "unknown",
        ),
        authority=AuthorityBlock(
            allowed_scopes=list(passport.allowed_scopes),
            financial_limit=passport.financial_limit,
            delegation_depth=passport.delegation_depth,
            verified_by_graph=graph.verify_chain(passport.identity) if graph else False,
        ),
        policy=PolicyBlock(
            policy_id=policy_id or ctx.policy_id,
            evaluation=policy_eval,  # type: ignore[arg-type]
            risk_score=risk_score,
        ),
        execution=ExecutionBlock(
            tool_called=tool_called,
            request_payload=request_payload,
            api_response=ApiResponseBlock(status_code=status_code, raw_body=raw_body),
        ),
        outcome_verification=build_outcome_verification_block(
            status=verdict if verdict in {"VERIFIED", "UNVERIFIED", "DISCREPANCY", "FAILED"} else "FAILED",  # type: ignore[arg-type]
            verification_method=verification_payload.get("verification_method", "DB_STATE_AND_LEDGER_CROSS_CHECK"),  # type: ignore[arg-type]
            state_before=verification_payload.get("state_before") or {},
            state_after=verification_payload.get("state_after") or {},
            discrepancy_detected=bool(verification_payload.get("discrepancy_detected")),
            external_transaction_id=verification_payload.get("external_transaction_id"),
            signing_key=ctx.signing_key,
        ),
    )

    ctx.store.index_receipt(receipt)
    result["aar_receipt"] = receipt.model_dump_document()
    result["outcome_status"] = verdict
    return result


def secure_agent_action(
    passport_id: str,
    required_scopes: list[str],
    *,
    parsed_intent: str = "EXECUTE_PAYMENT",
    target_resource_key: str = "target_resource",
    policy_id: str | None = None,
) -> Callable[[F], F]:
    """Decorator wrapping tool handlers with the secure agent pipeline."""

    def decorator(func: F) -> F:
        @functools.wraps(func)
        def sync_wrapper(*args: Any, **kwargs: Any) -> Any:
            def handler(**handler_kw: Any) -> dict[str, Any]:
                merged = {**kwargs, **handler_kw}
                outcome = func(*args, **merged)
                if inspect.isawaitable(outcome):
                    raise SecureActionError("use run_secure_agent_action for async handlers")
                return outcome  # type: ignore[return-value]

            return run_secure_agent_action(
                passport_id,
                required_scopes,
                handler,
                parsed_intent=parsed_intent,
                target_resource_key=target_resource_key,
                policy_id=policy_id,
                **kwargs,
            )

        return sync_wrapper  # type: ignore[return-value]

    return decorator
