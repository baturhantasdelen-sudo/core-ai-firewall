from __future__ import annotations

import hashlib
import json
import uuid
from datetime import datetime, timezone
from typing import Any


class EvidenceEngine:
    """Ajan eylemlerini ve dönen yanıtları değiştirilemez biçimde imzalar."""

    @staticmethod
    def generate_evidence(
        session_id: str,
        agent_id: str,
        tool_name: str,
        action_payload: dict[str, Any],
        execution_result: dict[str, Any],
    ) -> dict[str, Any]:
        timestamp_utc = datetime.now(timezone.utc).isoformat()
        raw_string = (
            f"{agent_id}:{session_id}:{tool_name}:"
            f"{json.dumps(action_payload, sort_keys=True)}:"
            f"{json.dumps(execution_result, sort_keys=True)}:"
            f"{timestamp_utc}"
        )
        payload_hash = hashlib.sha256(raw_string.encode("utf-8")).hexdigest()

        return {
            "evidence_id": f"EV-{uuid.uuid4()}",
            "timestamp_utc": timestamp_utc,
            "agent_id": agent_id,
            "session_id": session_id,
            "tool_name": tool_name,
            "payload_hash": payload_hash,
            "status": "VERIFIED_ACTION",
        }

    @staticmethod
    def generate_decision_evidence(
        session_id: str,
        agent_id: str,
        tool_name: str,
        decision: str,
        reason: str,
        action_payload: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """SHA-256 evidence for policy/firewall BLOCK or audit decisions."""
        timestamp_utc = datetime.now(timezone.utc).isoformat()
        payload = action_payload or {}
        raw_string = (
            f"{agent_id}:{session_id}:{tool_name}:{decision}:{reason}:"
            f"{json.dumps(payload, sort_keys=True)}:{timestamp_utc}"
        )
        payload_hash = hashlib.sha256(raw_string.encode("utf-8")).hexdigest()

        return {
            "evidence_id": f"EV-{uuid.uuid4()}",
            "timestamp_utc": timestamp_utc,
            "agent_id": agent_id,
            "session_id": session_id,
            "tool_name": tool_name,
            "decision": decision,
            "reason": reason,
            "payload_hash": payload_hash,
            "status": "POLICY_DECISION",
        }
