"""
Local anomaly & memory ledger — encrypted SQLite + optional JSONL mirror.

Air-gap contract: this module performs **no network I/O**.
"""

from __future__ import annotations

import json
import sqlite3
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Literal

from nexus._crypto import decrypt_blob, encrypt_blob, load_or_create_memory_key, sha256_hex
from nexus._paths import data_dir

EventKind = Literal[
    "action_verified",
    "blocked_threat",
    "false_positive",
    "endpoint_unreachable",
    "policy_patched",
    "policy_rollback",
]


def _utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


@dataclass
class MemoryStats:
    blocked_in_window: int
    false_positives_in_window: int
    unreachable_in_window: int
    total_events: int


class LocalMemoryLedger:
    """Encrypted local store for threats, false positives, and UAR metadata."""

    def __init__(self, root: Path | None = None) -> None:
        self.root = root or data_dir()
        self.root.mkdir(parents=True, exist_ok=True)
        self._key = load_or_create_memory_key(self.root)
        self.db_path = self.root / "memory.db"
        self.jsonl_path = self.root / "events.jsonl.enc"
        self._conn = sqlite3.connect(self.db_path)
        self._conn.row_factory = sqlite3.Row
        self._init_schema()

    def close(self) -> None:
        self._conn.close()

    def _init_schema(self) -> None:
        self._conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS events (
                id TEXT PRIMARY KEY,
                ts TEXT NOT NULL,
                kind TEXT NOT NULL,
                decision TEXT,
                tool TEXT,
                intent_preview TEXT,
                uar_receipt_id TEXT,
                payload_enc TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_events_ts ON events(ts);
            CREATE INDEX IF NOT EXISTS idx_events_kind ON events(kind);
            CREATE TABLE IF NOT EXISTS policy_audits (
                id TEXT PRIMARY KEY,
                ts TEXT NOT NULL,
                patch_id TEXT NOT NULL,
                before_hash TEXT NOT NULL,
                after_hash TEXT NOT NULL,
                evidence_hash TEXT NOT NULL,
                payload_enc TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS policy_snapshots (
                id TEXT PRIMARY KEY,
                ts TEXT NOT NULL,
                policy_hash TEXT NOT NULL,
                path TEXT NOT NULL,
                stable INTEGER NOT NULL DEFAULT 1,
                evidence_hash TEXT NOT NULL
            );
            """
        )
        self._conn.commit()

    def _seal(self, payload: dict[str, Any]) -> str:
        return encrypt_blob(json.dumps(payload, sort_keys=True).encode("utf-8"), self._key)

    def _open(self, token: str) -> dict[str, Any]:
        return json.loads(decrypt_blob(token, self._key).decode("utf-8"))

    def _append_jsonl(self, record: dict[str, Any]) -> None:
        line = self._seal(record)
        with self.jsonl_path.open("a", encoding="utf-8") as fh:
            fh.write(line + "\n")

    def record_action(
        self,
        *,
        decision: str,
        tool: str,
        intent: str,
        uar_receipt_id: str,
        receipt_id: str | None = None,
        source: str = "verify",
        endpoint_reachable: bool = True,
        extra: dict[str, Any] | None = None,
    ) -> str:
        event_id = f"mem_{uuid.uuid4().hex[:16]}"
        decision_u = decision.upper()
        if not endpoint_reachable:
            kind: EventKind = "endpoint_unreachable"
        elif decision_u == "BLOCK":
            kind = "blocked_threat"
        else:
            kind = "action_verified"

        payload = {
            "event_id": event_id,
            "kind": kind,
            "decision": decision_u,
            "tool": tool,
            "intent": intent,
            "intent_hash": sha256_hex(intent),
            "uar_receipt_id": uar_receipt_id,
            "receipt_id": receipt_id,
            "source": source,
            "endpoint_reachable": endpoint_reachable,
            "extra": extra or {},
        }
        enc = self._seal(payload)
        ts = _utc_now()
        self._conn.execute(
            """
            INSERT INTO events (id, ts, kind, decision, tool, intent_preview, uar_receipt_id, payload_enc)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                event_id,
                ts,
                kind,
                decision_u,
                tool,
                intent[:120],
                uar_receipt_id,
                enc,
            ),
        )
        self._conn.commit()
        self._append_jsonl({"id": event_id, "ts": ts, **payload})
        return event_id

    def mark_false_positive(
        self,
        *,
        event_id: str | None = None,
        tool: str | None = None,
        intent: str | None = None,
        note: str = "",
    ) -> str:
        fp_id = f"fp_{uuid.uuid4().hex[:12]}"
        ref = event_id
        if not ref and tool:
            row = self._conn.execute(
                """
                SELECT id FROM events
                WHERE tool = ? AND kind = 'blocked_threat'
                ORDER BY ts DESC LIMIT 1
                """,
                (tool,),
            ).fetchone()
            ref = row["id"] if row else None

        payload = {
            "fp_id": fp_id,
            "ref_event_id": ref,
            "tool": tool,
            "intent": intent,
            "note": note,
        }
        enc = self._seal(payload)
        ts = _utc_now()
        self._conn.execute(
            """
            INSERT INTO events (id, ts, kind, decision, tool, intent_preview, uar_receipt_id, payload_enc)
            VALUES (?, ?, 'false_positive', 'FALSE_POSITIVE', ?, ?, '', ?)
            """,
            (fp_id, ts, tool or "", (intent or "")[:120], enc),
        )
        self._conn.commit()
        self._append_jsonl({"id": fp_id, "ts": ts, "kind": "false_positive", **payload})
        return fp_id

    def record_policy_audit(
        self,
        *,
        patch_id: str,
        before_hash: str,
        after_hash: str,
        reason: str,
        diff: dict[str, Any],
    ) -> str:
        audit_id = f"aud_{uuid.uuid4().hex[:16]}"
        core = {
            "audit_id": audit_id,
            "patch_id": patch_id,
            "before_hash": before_hash,
            "after_hash": after_hash,
            "reason": reason,
            "diff": diff,
            "timestamp": _utc_now(),
            "event": "POLICY_PATCH",
        }
        evidence_hash = sha256_hex(json.dumps(core, sort_keys=True))
        core["evidence_hash"] = evidence_hash
        enc = self._seal(core)
        self._conn.execute(
            """
            INSERT INTO policy_audits (id, ts, patch_id, before_hash, after_hash, evidence_hash, payload_enc)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (audit_id, core["timestamp"], patch_id, before_hash, after_hash, evidence_hash, enc),
        )
        self._conn.commit()
        self._append_jsonl({"kind": "policy_patched", **core})
        return evidence_hash

    def register_snapshot(
        self,
        *,
        snapshot_id: str,
        policy_hash: str,
        path: str,
        stable: bool = True,
        evidence_hash: str,
    ) -> None:
        self._conn.execute(
            """
            INSERT OR REPLACE INTO policy_snapshots (id, ts, policy_hash, path, stable, evidence_hash)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (snapshot_id, _utc_now(), policy_hash, path, 1 if stable else 0, evidence_hash),
        )
        self._conn.commit()

    def latest_stable_snapshot(self) -> sqlite3.Row | None:
        return self._conn.execute(
            """
            SELECT * FROM policy_snapshots
            WHERE stable = 1
            ORDER BY ts DESC
            LIMIT 1
            """
        ).fetchone()

    def get_snapshot(self, snapshot_id: str) -> sqlite3.Row | None:
        return self._conn.execute(
            "SELECT * FROM policy_snapshots WHERE id = ?",
            (snapshot_id,),
        ).fetchone()

    def stats(self, *, window_minutes: int = 60) -> MemoryStats:
        cutoff = (datetime.now(timezone.utc) - timedelta(minutes=window_minutes)).strftime(
            "%Y-%m-%dT%H:%M:%SZ"
        )
        blocked = self._conn.execute(
            "SELECT COUNT(*) AS c FROM events WHERE kind = 'blocked_threat' AND ts >= ?",
            (cutoff,),
        ).fetchone()["c"]
        fps = self._conn.execute(
            "SELECT COUNT(*) AS c FROM events WHERE kind = 'false_positive' AND ts >= ?",
            (cutoff,),
        ).fetchone()["c"]
        unreachable = self._conn.execute(
            "SELECT COUNT(*) AS c FROM events WHERE kind = 'endpoint_unreachable' AND ts >= ?",
            (cutoff,),
        ).fetchone()["c"]
        total = self._conn.execute("SELECT COUNT(*) AS c FROM events").fetchone()["c"]
        return MemoryStats(
            blocked_in_window=blocked,
            false_positives_in_window=fps,
            unreachable_in_window=unreachable,
            total_events=total,
        )

    def recent_blocked_tools(self, *, limit: int = 50) -> list[str]:
        rows = self._conn.execute(
            """
            SELECT tool FROM events
            WHERE kind = 'blocked_threat' AND tool != ''
            ORDER BY ts DESC LIMIT ?
            """,
            (limit,),
        ).fetchall()
        return [r["tool"] for r in rows]

    def recent_false_positive_tools(self, *, limit: int = 20) -> list[str]:
        rows = self._conn.execute(
            """
            SELECT tool FROM events
            WHERE kind = 'false_positive' AND tool != ''
            ORDER BY ts DESC LIMIT ?
            """,
            (limit,),
        ).fetchall()
        return [r["tool"] for r in rows]
