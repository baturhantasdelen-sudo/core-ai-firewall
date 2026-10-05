"""Nexus Shield Python SDK — secure agent actions and outcome interception."""

from .verify_action import SecurityException, VerifyActionResult, verify_action

__all__ = [
    "FalseSuccessInterceptor",
    "SecurityException",
    "VerifyActionResult",
    "intercept_and_log_outcome",
    "verify_action",
    "run_secure_agent_action",
    "secure_agent_action",
]


def __getattr__(name: str):
    if name in ("FalseSuccessInterceptor", "intercept_and_log_outcome"):
        from .interceptor import FalseSuccessInterceptor, intercept_and_log_outcome

        return FalseSuccessInterceptor if name == "FalseSuccessInterceptor" else intercept_and_log_outcome
    if name in ("run_secure_agent_action", "secure_agent_action"):
        from .decorators import run_secure_agent_action, secure_agent_action

        return run_secure_agent_action if name == "run_secure_agent_action" else secure_agent_action
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
