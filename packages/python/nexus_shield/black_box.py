"""Agent Black Box — privacy-preserving flight recorder for agent trajectories."""

from __future__ import annotations

import json
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Iterator

from nexus_shield.redaction import redact_value


class BlackBoxError(ValueError):
    """Invalid black box operation or query."""


@dataclass
class FlightRecord:
    """Single redacted trajectory event."""

    record_id: str
    timestamp: str
    agent_id: str
    prompt: str | None
    intent: str | None
    tool: str | None
    arguments: dict[str, Any]
    policy_decision: str | None
    api_response: dict[str, Any] | None
    state_change: dict[str, Any] | None
    errors: list[str]

    def to_dict(self) -> dict[str, Any]:
        return {
            "record_id": self.record_id,
            "timestamp": self.timestamp,
            "agent_id": self.agent_id,
            "prompt": self.prompt,
            "intent": self.intent,
            "tool": self.tool,
            "arguments": self.arguments,
            "policy_decision": self.policy_decision,
            "api_response": self.api_response,
            "state_change": self.state_change,
            "errors": self.errors,
        }


@dataclass
class AgentBlackBox:
    """
    Secure in-memory flight recorder for SOC / incident response export.

    All payloads are redacted before persistence.
    """

    tenant_id: str = "default"
    _records: list[FlightRecord] = field(default_factory=list, repr=False)

    def record(
        self,
        *,
        agent_id: str,
        prompt: str | None = None,
        intent: str | None = None,
        tool: str | None = None,
        arguments: dict[str, Any] | None = None,
        policy_decision: str | None = None,
        api_response: dict[str, Any] | None = None,
        state_change: dict[str, Any] | None = None,
        errors: list[str] | None = None,
    ) -> FlightRecord:
        if not agent_id:
            raise BlackBoxError("agent_id is required")
        ts = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        entry = FlightRecord(
            record_id=f"fbb_{uuid.uuid4().hex[:16]}",
            timestamp=ts,
            agent_id=str(agent_id),
            prompt=redact_value(prompt) if prompt is not None else None,
            intent=redact_value(intent) if intent is not None else None,
            tool=redact_value(tool) if tool is not None else None,
            arguments=redact_value(arguments or {}) if isinstance(arguments, dict) else {},
            policy_decision=redact_value(policy_decision) if policy_decision is not None else None,
            api_response=redact_value(api_response) if isinstance(api_response, dict) else None,
            state_change=redact_value(state_change) if isinstance(state_change, dict) else None,
            errors=[str(redact_value(e)) for e in (errors or [])],
        )
        self._records.append(entry)
        return entry

    def query(
        self,
        *,
        agent_id: str | None = None,
        since_iso: str | None = None,
        until_iso: str | None = None,
        tool: str | None = None,
        limit: int = 100,
    ) -> list[dict[str, Any]]:
        if limit < 1:
            raise BlackBoxError("limit must be >= 1")
        results: list[dict[str, Any]] = []
        for rec in reversed(self._records):
            if agent_id and rec.agent_id != agent_id:
                continue
            if tool and rec.tool != tool:
                continue
            if since_iso and rec.timestamp < since_iso:
                continue
            if until_iso and rec.timestamp > until_iso:
                continue
            results.append(rec.to_dict())
            if len(results) >= limit:
                break
        return list(reversed(results))

    def export_jsonl(self, *, agent_id: str | None = None) -> str:
        """SOC / compliance export (newline-delimited JSON, redacted)."""
        lines: list[str] = []
        for row in self.query(agent_id=agent_id, limit=10_000):
            lines.append(json.dumps({"tenant_id": self.tenant_id, **row}, ensure_ascii=False))
        return "\n".join(lines) + ("\n" if lines else "")

    def iter_records(self) -> Iterator[FlightRecord]:
        return iter(self._records)

    def count(self) -> int:
        return len(self._records)
