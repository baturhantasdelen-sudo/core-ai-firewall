"""Local UAR receipt store — air-gapped, no Nexus Cloud required."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from enterprise.evidence_chain import compute_evidence_bundle_hash, verify_uar_receipt


@dataclass
class LocalUarStore:
    """Append-only JSONL + in-memory index for receipt lookup by ID."""

    store_path: Path = field(default_factory=lambda: Path("enterprise/data/uar_receipts.jsonl"))
    _index: dict[str, dict[str, Any]] = field(default_factory=dict, repr=False)

    def __post_init__(self) -> None:
        self.load()

    def save_receipt(
        self,
        receipt: dict[str, Any],
        *,
        tenant_id: str,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        rid = receipt.get("receipt_id")
        if not rid:
            raise ValueError("receipt_id required")
        record = {
            "tenant_id": tenant_id,
            "receipt_id": rid,
            "evidence_bundle_sha256": receipt.get("evidence_bundle_hash"),
            "receipt": receipt,
            "metadata": metadata or {},
        }
        self.store_path.parent.mkdir(parents=True, exist_ok=True)
        with self.store_path.open("a", encoding="utf-8") as f:
            f.write(json.dumps(record, ensure_ascii=False) + "\n")
        self._index[rid] = record
        return record

    def get_by_receipt_id(self, receipt_id: str) -> dict[str, Any] | None:
        if receipt_id not in self._index:
            self.load()
        return self._index.get(receipt_id)

    def verify_by_receipt_id(
        self,
        receipt_id: str,
        *,
        evidence_bundle_hash: str | None = None,
    ) -> dict[str, Any]:
        record = self.get_by_receipt_id(receipt_id)
        if not record:
            return {"valid": False, "receipt_id": receipt_id, "error": "receipt_not_found"}
        receipt = record["receipt"]
        result = verify_uar_receipt(receipt)
        if evidence_bundle_hash and result.get("evidence_bundle_sha256") != evidence_bundle_hash:
            result["valid"] = False
            result["hash_mismatch"] = True
        result["tenant_id"] = record.get("tenant_id")
        result["stored"] = True
        return result

    def load(self) -> None:
        if not self.store_path.is_file():
            return
        self._index.clear()
        for line in self.store_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                row = json.loads(line)
                rid = row.get("receipt_id")
                if rid:
                    self._index[rid] = row
            except json.JSONDecodeError:
                continue
