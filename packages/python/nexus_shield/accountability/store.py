"""In-memory AAR index and incident log (production: replace with durable store)."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from threading import Lock
from typing import Any

from nexus_shield.core.aar import UniversalActionReceipt


@dataclass(frozen=True)
class IncidentRecord:
    incident_id: str
    timestamp: str
    severity: str
    code: str
    message: str
    receipt_id: str | None
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "incident_id": self.incident_id,
            "timestamp": self.timestamp,
            "severity": self.severity,
            "code": self.code,
            "message": self.message,
            "receipt_id": self.receipt_id,
            "metadata": self.metadata,
        }


class AARStore:
    def __init__(self) -> None:
        self._lock = Lock()
        self._receipts: dict[str, dict[str, Any]] = {}
        self._incidents: list[IncidentRecord] = []
        self._audit_trail: list[dict[str, Any]] = []

    def index_receipt(self, receipt: UniversalActionReceipt) -> None:
        doc = receipt.model_dump_document()
        with self._lock:
            self._receipts[receipt.receipt_id] = doc

    def list_receipts(self, *, status: str | None = None) -> list[dict[str, Any]]:
        with self._lock:
            items = list(self._receipts.values())
        if status:
            status_u = status.upper()
            items = [
                r
                for r in items
                if str(r.get("outcome_verification", {}).get("status", "")).upper() == status_u
            ]
        return sorted(items, key=lambda r: r.get("timestamp", ""), reverse=True)

    def get_receipt(self, receipt_id: str) -> dict[str, Any] | None:
        with self._lock:
            return self._receipts.get(receipt_id)

    def add_incident(
        self,
        *,
        code: str,
        message: str,
        severity: str = "HIGH",
        receipt_id: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> IncidentRecord:
        ts = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        incident_id = f"inc_{len(self._incidents) + 1:06d}"
        record = IncidentRecord(
            incident_id=incident_id,
            timestamp=ts,
            severity=severity,
            code=code,
            message=message,
            receipt_id=receipt_id,
            metadata=metadata or {},
        )
        with self._lock:
            self._incidents.append(record)
        return record

    def list_incidents(self) -> list[dict[str, Any]]:
        with self._lock:
            return [i.to_dict() for i in reversed(self._incidents)]

    def append_audit(self, entry: dict[str, Any]) -> None:
        with self._lock:
            self._audit_trail.append(entry)

    def list_audit_trail(self) -> list[dict[str, Any]]:
        with self._lock:
            return list(reversed(self._audit_trail))

    def clear(self) -> None:
        with self._lock:
            self._receipts.clear()
            self._incidents.clear()
            self._audit_trail.clear()
