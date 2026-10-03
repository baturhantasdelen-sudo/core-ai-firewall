"""Agent Passport — cryptographically structured agent identity and authority bounds."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any


class PassportValidationError(ValueError):
    """Raised when passport data or action request is invalid."""


@dataclass
class AgentPassport:
    agent_id: str
    owner: str
    organization: str
    purpose: str
    allowed_systems: list[str] = field(default_factory=list)
    allowed_tools: list[str] = field(default_factory=list)
    max_financial_authority: float = 0.0
    time_validity: dict[str, Any] = field(default_factory=dict)
    risk_level: str = "medium"

    def summary(self) -> dict[str, Any]:
        """Embedded passport summary for UAR 2.0 receipts."""
        return {
            "agent_id": self.agent_id,
            "owner": self.owner,
            "organization": self.organization,
            "purpose": self.purpose,
            "risk_level": self.risk_level,
            "max_financial_authority": self.max_financial_authority,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> AgentPassport:
        required = ("agent_id", "owner", "organization", "purpose")
        for key in required:
            if not data.get(key):
                raise PassportValidationError(f"missing required passport field: {key}")
        systems = data.get("allowed_systems") or []
        tools = data.get("allowed_tools") or []
        if not isinstance(systems, list) or not isinstance(tools, list):
            raise PassportValidationError("allowed_systems and allowed_tools must be lists")
        try:
            max_fin = float(data.get("max_financial_authority", 0.0))
        except (TypeError, ValueError) as exc:
            raise PassportValidationError("max_financial_authority must be numeric") from exc
        tv = data.get("time_validity") or {}
        if not isinstance(tv, dict):
            raise PassportValidationError("time_validity must be a dict")
        return cls(
            agent_id=str(data["agent_id"]),
            owner=str(data["owner"]),
            organization=str(data["organization"]),
            purpose=str(data["purpose"]),
            allowed_systems=[str(s) for s in systems],
            allowed_tools=[str(t) for t in tools],
            max_financial_authority=max_fin,
            time_validity=tv,
            risk_level=str(data.get("risk_level", "medium")),
        )


def _parse_iso(ts: str) -> datetime:
    normalized = ts.replace("Z", "+00:00")
    return datetime.fromisoformat(normalized).astimezone(timezone.utc)


def _within_time_validity(time_validity: dict[str, Any], now: datetime | None = None) -> bool:
    if not time_validity:
        return True
    now = now or datetime.now(timezone.utc)
    start_iso = time_validity.get("start_iso") or time_validity.get("start")
    end_iso = time_validity.get("end_iso") or time_validity.get("end")
    if start_iso and end_iso:
        return _parse_iso(str(start_iso)) <= now <= _parse_iso(str(end_iso))
    start_hour = time_validity.get("start_hour")
    end_hour = time_validity.get("end_hour")
    if start_hour is not None and end_hour is not None:
        hour = now.hour
        sh, eh = int(start_hour), int(end_hour)
        if sh <= eh:
            return sh <= hour <= eh
        return hour >= sh or hour <= eh
    return True


def validate_passport(passport: AgentPassport, requested_action: dict[str, Any]) -> bool:
    """
    Return True if the requested tool/action complies with passport bounds.

    ``requested_action`` expects keys such as ``tool``, ``system``, ``params`` (may include ``amount``).
    """
    if not isinstance(requested_action, dict):
        raise PassportValidationError("requested_action must be a dict")

    tool = requested_action.get("tool")
    if not tool or not isinstance(tool, str):
        raise PassportValidationError("requested_action.tool is required")
    if passport.allowed_tools and tool not in passport.allowed_tools:
        return False

    system = requested_action.get("system")
    if system is not None and passport.allowed_systems:
        if str(system) not in passport.allowed_systems:
            return False

    params = requested_action.get("params") or {}
    if not isinstance(params, dict):
        raise PassportValidationError("requested_action.params must be a dict")
    amount = params.get("amount")
    if amount is not None:
        try:
            value = float(amount)
        except (TypeError, ValueError) as exc:
            raise PassportValidationError("params.amount must be numeric") from exc
        if value > passport.max_financial_authority:
            return False

    if not _within_time_validity(passport.time_validity):
        return False

    return True
