"""FastAPI/Starlette middleware — passport headers, scope and financial enforcement."""

from __future__ import annotations

import json
from typing import Any, Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from nexus_shield.accountability.context import get_accountability_context
from nexus_shield.core.passport import AgentPassportRecord, PassportError, validate_passport_action
from nexus_shield.sdk.interceptor import intercept_and_log_outcome


class GatewayPolicyViolation(Exception):
    def __init__(self, code: str, message: str, details: dict[str, Any]) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.details = details

    def to_report(self) -> dict[str, Any]:
        return {
            "error": "policy_violation",
            "code": self.code,
            "message": self.message,
            "details": self.details,
        }


def _parse_passport_header(raw: str | None) -> AgentPassportRecord:
    if not raw or not raw.strip():
        raise GatewayPolicyViolation(
            "MISSING_PASSPORT",
            "X-Nexus-Passport header is required",
            {},
        )
    try:
        data = json.loads(raw)
        passport = AgentPassportRecord.model_validate(data)
    except (json.JSONDecodeError, ValueError) as exc:
        raise GatewayPolicyViolation(
            "INVALID_PASSPORT",
            "X-Nexus-Passport must be valid JSON matching AgentPassportRecord",
            {"reason": str(exc)},
        ) from exc
    return passport


def _required_scopes_from_request(request: Request) -> list[str]:
    header = request.headers.get("x-nexus-required-scopes", "")
    if header.strip():
        return [s.strip() for s in header.split(",") if s.strip()]
    return ["payments:write"]


def _financial_amount(request: Request) -> float | None:
    raw = request.headers.get("x-nexus-amount")
    if raw is None or not raw.strip():
        return None
    try:
        return float(raw)
    except ValueError as exc:
        raise GatewayPolicyViolation(
            "INVALID_AMOUNT",
            "X-Nexus-Amount must be numeric",
            {"value": raw},
        ) from exc


def validate_gateway_request(request: Request) -> tuple[AgentPassportRecord, dict[str, Any]]:
    ctx = get_accountability_context()
    passport_header = _parse_passport_header(request.headers.get("x-nexus-passport"))
    registered = ctx.get_passport(passport_header.passport_id)
    if registered is None:
        raise GatewayPolicyViolation(
            "UNKNOWN_PASSPORT",
            f"passport {passport_header.passport_id} is not registered",
            {},
        )
    passport = registered
    required_scopes = _required_scopes_from_request(request)
    amount = _financial_amount(request)

    try:
        validate_passport_action(
            passport,
            required_scopes=required_scopes,
            amount=amount,
            signing_key=ctx.signing_key,
        )
    except PassportError as exc:
        raise GatewayPolicyViolation(
            "PASSPORT_SCOPE_VIOLATION",
            str(exc),
            {"required_scopes": required_scopes, "amount": amount},
        ) from exc

    graph = ctx.delegation_graph
    if graph is not None:
        check = graph.validate_action(
            passport.identity,
            required_scopes=required_scopes,
            amount=amount,
        )
        if not check.get("allowed"):
            ctx.store.append_audit(
                {
                    "event": "GATEWAY_DELEGATION_DENIED",
                    "agent_id": passport.identity,
                    "reason": check.get("reason"),
                }
            )
            raise GatewayPolicyViolation(
                "DELEGATION_VIOLATION",
                str(check.get("reason")),
                check,
            )

    intent = {
        "raw_prompt": request.headers.get("x-agent-intent") or "",
        "parsed_intent": request.headers.get("x-nexus-parsed-intent") or "EXECUTE_PAYMENT",
        "target_resource": request.headers.get("x-nexus-target-resource") or "",
    }
    request.state.nexus_passport = passport  # type: ignore[attr-defined]
    request.state.nexus_intent = intent  # type: ignore[attr-defined]
    return passport, intent


class AccountabilityGatewayMiddleware(BaseHTTPMiddleware):
    """Enforce passport headers on accountability routes; post-check false success on 200 responses."""

    def __init__(
        self,
        app: Any,
        *,
        path_prefix: str = "/v1/accountability",
        post_verify: bool = True,
    ) -> None:
        super().__init__(app)
        self.path_prefix = path_prefix.rstrip("/")
        self.post_verify = post_verify

    async def dispatch(self, request: Request, call_next: Callable[[Request], Any]) -> Response:
        if not request.url.path.startswith(self.path_prefix):
            return await call_next(request)

        if request.method in {"GET", "HEAD", "OPTIONS"}:
            return await call_next(request)

        try:
            validate_gateway_request(request)
        except GatewayPolicyViolation as violation:
            return JSONResponse(status_code=403, content=violation.to_report())

        state_before_raw = request.headers.get("x-nexus-state-before")
        state_before: dict[str, Any] = {}
        if state_before_raw:
            try:
                state_before = json.loads(state_before_raw)
            except json.JSONDecodeError:
                return JSONResponse(
                    status_code=400,
                    content={
                        "error": "invalid_state_before",
                        "message": "X-Nexus-State-Before must be JSON",
                    },
                )

        response = await call_next(request)

        if (
            self.post_verify
            and response.status_code == 200
            and hasattr(request.state, "nexus_intent")
        ):
            intent = getattr(request.state, "nexus_intent")
            body_bytes = b""
            if hasattr(response, "body"):
                body_bytes = response.body  # type: ignore[attr-defined]
            execution_result = {
                "status_code": 200,
                "raw_body": body_bytes.decode("utf-8", errors="replace") or "{}",
            }
            try:
                verdict, payload = intercept_and_log_outcome(
                    intent=intent,
                    execution_result=execution_result,
                    state_snapshot_before=state_before,
                )
                if verdict == "UNVERIFIED":
                    get_accountability_context().store.append_audit(
                        {
                            "event": "GATEWAY_FALSE_SUCCESS",
                            "intent": intent,
                            "verification": payload,
                        }
                    )
            except RuntimeError:
                pass

        return response
