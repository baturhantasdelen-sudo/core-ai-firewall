"""Redis-backed session trajectory and immutable audit trail with in-memory fallback."""

from __future__ import annotations

import hashlib
import json
import logging
import os
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger("nexus.governance.redis")

DEFAULT_REDIS_URL = os.getenv("REDIS_URL", "redis://nexus_redis:6379/0")
TRAJECTORY_PREFIX = "trajectory:"
LEGACY_TRAJECTORY_PREFIX = "nexus:trajectory:"
APPROVAL_PREFIX = "approval:"
AUDIT_LIST_KEY = "nexus:audit:trail"
MAX_TRAJECTORY_ACTIONS = 20
MAX_AUDIT_ENTRIES = 1000
TRAJECTORY_TTL_SEC = 3600
APPROVAL_TTL_SEC = 86400


class GovernanceRedisStore:
    """Async Redis store with graceful degradation to process memory."""

    _async_client: Any | None = None
    _redis_available: bool = False
    _memory_trajectories: dict[str, list[str]] = defaultdict(list)
    _memory_audit: list[dict[str, Any]] = []
    _memory_approvals: dict[str, dict[str, Any]] = {}
    _chain_hash: str = "GENESIS"

    @classmethod
    async def init(cls, redis_url: str | None = None) -> bool:
        url = redis_url or DEFAULT_REDIS_URL
        try:
            import redis.asyncio as redis

            cls._async_client = redis.from_url(url, decode_responses=True)
            await cls._async_client.ping()
            cls._redis_available = True
            logger.info("Governance Redis connected: %s", url)
            return True
        except Exception as exc:
            cls._async_client = None
            cls._redis_available = False
            logger.warning("Governance Redis unavailable, using in-memory fallback: %s", exc)
            return False

    @classmethod
    async def close(cls) -> None:
        if cls._async_client is not None:
            await cls._async_client.aclose()
            cls._async_client = None
        cls._redis_available = False

    @classmethod
    def is_redis_connected(cls) -> bool:
        return cls._redis_available and cls._async_client is not None

    @staticmethod
    def _trajectory_key(session_id: str) -> str:
        return f"{TRAJECTORY_PREFIX}{session_id}"

    @staticmethod
    def _decode_tool_item(item: str) -> str:
        try:
            parsed = json.loads(item)
        except json.JSONDecodeError:
            return item
        if isinstance(parsed, dict):
            return str(parsed.get("tool_name", item))
        return str(parsed)

    @classmethod
    def _normalize_tool_list(cls, raw_items: list[str]) -> list[str]:
        return [cls._decode_tool_item(item) for item in raw_items]

    @classmethod
    async def _lrange_trajectory_keys(cls, session_id: str) -> list[str]:
        if cls._async_client is None:
            return []
        key = cls._trajectory_key(session_id)
        raw_items = await cls._async_client.lrange(key, 0, -1)
        if raw_items:
            return cls._normalize_tool_list(raw_items)
        legacy_key = f"{LEGACY_TRAJECTORY_PREFIX}{session_id}"
        legacy_items = await cls._async_client.lrange(legacy_key, 0, -1)
        return cls._normalize_tool_list(legacy_items)

    @classmethod
    def _get_trajectory_memory(cls, session_id: str) -> list[str]:
        return list(cls._memory_trajectories.get(session_id, []))

    @classmethod
    async def get_trajectory_tools(cls, session_id: str) -> list[str]:
        """Fetch session tool history as decoded plain strings."""
        if cls._async_client is not None:
            try:
                return await cls._lrange_trajectory_keys(session_id)
            except Exception as exc:
                logger.warning("Redis trajectory read failed for session=%s: %s", session_id, exc)
        return cls._get_trajectory_memory(session_id)

    @classmethod
    def _push_trajectory_memory(cls, session_id: str, tool_name: str) -> list[str]:
        history = cls._memory_trajectories[session_id]
        history.append(tool_name)
        if len(history) > MAX_TRAJECTORY_ACTIONS:
            cls._memory_trajectories[session_id] = history[-MAX_TRAJECTORY_ACTIONS:]
        return list(cls._memory_trajectories[session_id])

    @classmethod
    async def push_trajectory_tool(cls, session_id: str, tool_name: str) -> list[str]:
        """Append tool_name to trajectory:{session_id} and refresh TTL."""
        if cls._async_client is not None:
            try:
                key = cls._trajectory_key(session_id)
                await cls._async_client.rpush(key, tool_name)
                await cls._async_client.ltrim(key, -MAX_TRAJECTORY_ACTIONS, -1)
                await cls._async_client.expire(key, TRAJECTORY_TTL_SEC)
                raw_items = await cls._async_client.lrange(key, 0, -1)
                return cls._normalize_tool_list(raw_items)
            except Exception as exc:
                logger.warning("Redis trajectory write failed for session=%s: %s", session_id, exc)
        return cls._push_trajectory_memory(session_id, tool_name)

    @classmethod
    async def get_trajectory(cls, session_id: str) -> list[dict[str, Any]]:
        """Backward-compatible trajectory entries for API consumers."""
        tools = await cls.get_trajectory_tools(session_id)
        return [
            {
                "index": index,
                "tool_name": tool,
                "agent_id": "",
                "timestamp_utc": "",
            }
            for index, tool in enumerate(tools, start=1)
        ]

    @classmethod
    async def append_trajectory_action(cls, session_id: str, action: dict[str, Any]) -> list[dict[str, Any]]:
        tool_name = str(action.get("tool_name", ""))
        await cls.push_trajectory_tool(session_id, tool_name)
        return await cls.get_trajectory(session_id)

    @classmethod
    def _append_audit_memory(cls, record: dict[str, Any]) -> dict[str, Any]:
        cls._memory_audit.append(record)
        if len(cls._memory_audit) > MAX_AUDIT_ENTRIES:
            cls._memory_audit = cls._memory_audit[-MAX_AUDIT_ENTRIES:]
        return record

    @classmethod
    async def append_audit_record(cls, entry: dict[str, Any]) -> dict[str, Any]:
        record = {
            **entry,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "prev_hash": cls._chain_hash,
        }
        payload = json.dumps(record, sort_keys=True, default=str)
        record["entry_hash"] = hashlib.sha256(payload.encode()).hexdigest()
        cls._chain_hash = record["entry_hash"]

        if cls._async_client is not None:
            try:
                await cls._async_client.lpush(AUDIT_LIST_KEY, json.dumps(record, sort_keys=True, default=str))
                await cls._async_client.ltrim(AUDIT_LIST_KEY, 0, MAX_AUDIT_ENTRIES - 1)
            except Exception as exc:
                logger.warning("Redis audit append failed: %s", exc)

        return cls._append_audit_memory(record)

    @classmethod
    async def recent_audit_records(cls, limit: int = 50) -> tuple[list[dict[str, Any]], int]:
        records: list[dict[str, Any]] = []

        if cls._async_client is not None:
            try:
                raw_items = await cls._async_client.lrange(AUDIT_LIST_KEY, 0, limit - 1)
                for item in raw_items:
                    records.append(json.loads(item))
            except Exception as exc:
                logger.warning("Redis audit read failed: %s", exc)

        if not records and cls._memory_audit:
            records = cls._memory_audit[-limit:]

        records = list(reversed(records))
        total = len(cls._memory_audit)
        if cls._async_client is not None:
            try:
                total = int(await cls._async_client.llen(AUDIT_LIST_KEY))
            except Exception:
                total = max(total, len(records))
        return records, total

    @staticmethod
    def _approval_key(approval_id: str) -> str:
        return f"{APPROVAL_PREFIX}{approval_id}"

    @classmethod
    async def save_pending_approval(cls, approval_id: str, record: dict[str, Any]) -> dict[str, Any]:
        payload = {
            **record,
            "approval_id": approval_id,
            "status": "PENDING_APPROVAL",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        serialized = json.dumps(payload, sort_keys=True, default=str)

        if cls._async_client is not None:
            try:
                await cls._async_client.setex(
                    cls._approval_key(approval_id),
                    APPROVAL_TTL_SEC,
                    serialized,
                )
            except Exception as exc:
                logger.warning("Redis approval save failed for %s: %s", approval_id, exc)

        cls._memory_approvals[approval_id] = payload
        return payload

    @classmethod
    async def get_pending_approval(cls, approval_id: str) -> dict[str, Any] | None:
        if cls._async_client is not None:
            try:
                raw = await cls._async_client.get(cls._approval_key(approval_id))
                if raw:
                    return json.loads(raw)
            except Exception as exc:
                logger.warning("Redis approval read failed for %s: %s", approval_id, exc)

        record = cls._memory_approvals.get(approval_id)
        if record and record.get("status") == "PENDING_APPROVAL":
            return dict(record)
        return None

    @classmethod
    async def resolve_pending_approval(
        cls,
        approval_id: str,
        *,
        status: str,
        reviewer_notes: str = "",
    ) -> dict[str, Any] | None:
        record = await cls.get_pending_approval(approval_id)
        if record is None:
            return None

        resolved = {
            **record,
            "status": status,
            "reviewer_notes": reviewer_notes,
            "resolved_at": datetime.now(timezone.utc).isoformat(),
        }

        if cls._async_client is not None:
            try:
                await cls._async_client.delete(cls._approval_key(approval_id))
            except Exception as exc:
                logger.warning("Redis approval delete failed for %s: %s", approval_id, exc)

        cls._memory_approvals.pop(approval_id, None)
        cls._memory_approvals[f"{approval_id}:resolved"] = resolved
        return resolved

    @classmethod
    def reset_memory_state(cls) -> None:
        """Test helper — clears in-memory fallback state."""
        cls._memory_trajectories.clear()
        cls._memory_audit.clear()
        cls._memory_approvals.clear()
        cls._chain_hash = "GENESIS"
