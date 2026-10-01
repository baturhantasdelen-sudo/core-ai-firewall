"""
Dynamic policy patching — local UAR self-audit trail, rollback to last stable snapshot.
"""

from __future__ import annotations

import copy
import json
import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from nexus._crypto import sha256_hex
from nexus._paths import data_dir, default_policy_path, policy_snapshots_dir, repo_root
from nexus.memory import LocalMemoryLedger

try:
    import yaml
except ImportError:  # pragma: no cover - CI installs pyyaml
    yaml = None  # type: ignore[assignment]


def _utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _load_yaml_text(text: str) -> dict[str, Any]:
    if yaml is not None:
        loaded = yaml.safe_load(text) or {}
        return dict(loaded)
    return json.loads(text)


def _dump_yaml(data: dict[str, Any]) -> str:
    if yaml is not None:
        return yaml.safe_dump(data, sort_keys=False, default_flow_style=False)
    return json.dumps(data, indent=2)


def load_policy(path: Path | None = None) -> dict[str, Any]:
    policy_path = path or default_policy_path()
    if not policy_path.is_file():
        seed = repo_root() / "nexus" / "policy.yml"
        if seed.is_file():
            shutil.copyfile(seed, data_dir() / "policy.effective.yml")
            policy_path = data_dir() / "policy.effective.yml"
        else:
            return {"version": 1, "high_risk_tools": [], "blocked_tools": [], "allowed_tools": []}
    return _load_yaml_text(policy_path.read_text(encoding="utf-8"))


def save_policy(data: dict[str, Any], path: Path | None = None) -> Path:
    target = path or (data_dir() / "policy.effective.yml")
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(_dump_yaml(data), encoding="utf-8")
    return target


def policy_hash(data: dict[str, Any]) -> str:
    return sha256_hex(json.dumps(data, sort_keys=True))


class PolicyEvolutionEngine:
    """Autonomous, local-only policy patcher with cryptographic self-auditing."""

    def __init__(self, memory: LocalMemoryLedger | None = None) -> None:
        self.memory = memory or LocalMemoryLedger()

    def should_evolve(
        self,
        *,
        policy: dict[str, Any],
        endpoint_reachable: bool,
    ) -> tuple[bool, str]:
        if not (policy.get("evolution") or {}).get("enabled", True):
            return False, "evolution_disabled"

        stats = self.memory.stats(
            window_minutes=int((policy.get("anomaly") or {}).get("blocked_window_minutes", 60))
        )
        anomaly = policy.get("anomaly") or {}
        blocked_threshold = int(anomaly.get("blocked_count_threshold", 5))
        fp_threshold = int(anomaly.get("false_positive_threshold", 2))

        evolution = policy.get("evolution") or {}
        if not endpoint_reachable and evolution.get("patch_on_endpoint_unreachable", True):
            if stats.unreachable_in_window >= 1:
                return True, "endpoint_unreachable"

        if stats.blocked_in_window >= blocked_threshold:
            return True, "blocked_anomaly_threshold"

        if stats.false_positives_in_window >= fp_threshold:
            return True, "false_positive_threshold"

        return False, "stable"

    def _snapshot_policy(self, policy: dict[str, Any], *, stable: bool = True) -> str:
        snap_id = f"snap_{uuid.uuid4().hex[:12]}"
        snap_dir = policy_snapshots_dir()
        path = snap_dir / f"{snap_id}.yml"
        save_policy(policy, path)
        ph = policy_hash(policy)
        audit_core = {
            "event": "POLICY_SNAPSHOT",
            "snapshot_id": snap_id,
            "policy_hash": ph,
            "timestamp": _utc_now(),
            "stable": stable,
        }
        evidence = sha256_hex(json.dumps(audit_core, sort_keys=True))
        self.memory.register_snapshot(
            snapshot_id=snap_id,
            policy_hash=ph,
            path=str(path),
            stable=stable,
            evidence_hash=evidence,
        )
        return snap_id

    def evolve(
        self,
        *,
        reason: str,
        endpoint_reachable: bool,
    ) -> dict[str, Any] | None:
        policy = load_policy()
        should, why = self.should_evolve(policy=policy, endpoint_reachable=endpoint_reachable)
        if not should:
            return None

        before_hash = policy_hash(policy)
        self._snapshot_policy(policy, stable=True)

        updated = copy.deepcopy(policy)
        blocked = set(updated.get("blocked_tools") or [])
        allowed = set(updated.get("allowed_tools") or [])
        high_risk = set(updated.get("high_risk_tools") or [])

        if why == "false_positive_threshold":
            for tool in self.memory.recent_false_positive_tools():
                if tool in blocked:
                    blocked.discard(tool)
                allowed.add(tool)
        elif why == "blocked_anomaly_threshold":
            for tool in self.memory.recent_blocked_tools():
                if tool and tool not in allowed:
                    high_risk.add(tool)
                    blocked.add(tool)
        elif why == "endpoint_unreachable":
            updated.setdefault("evolution", {})["last_offline_patch"] = _utc_now()
            for tool in self.memory.recent_blocked_tools()[:3]:
                if tool:
                    high_risk.add(tool)

        updated["high_risk_tools"] = sorted(high_risk)
        updated["blocked_tools"] = sorted(blocked)
        updated["allowed_tools"] = sorted(allowed)
        updated.setdefault("meta", {})["last_patch_reason"] = reason or why
        updated["meta"]["last_patch_at"] = _utc_now()

        after_hash = policy_hash(updated)
        patch_id = f"patch_{uuid.uuid4().hex[:12]}"
        diff = {
            "reason": why,
            "high_risk_tools": updated["high_risk_tools"],
            "blocked_tools": updated["blocked_tools"],
            "allowed_tools": updated["allowed_tools"],
        }
        evidence = self.memory.record_policy_audit(
            patch_id=patch_id,
            before_hash=before_hash,
            after_hash=after_hash,
            reason=why,
            diff=diff,
        )
        save_policy(updated)
        return {
            "patch_id": patch_id,
            "reason": why,
            "before_hash": before_hash,
            "after_hash": after_hash,
            "policy_audit_uar": evidence,
        }


def rollback_policy(*, to_snapshot_id: str | None = None) -> dict[str, Any]:
    """
    Restore the last stable policy snapshot (or a specific snapshot id).
    One-shot CLI: ``python -m nexus.evolution rollback``
    """
    memory = LocalMemoryLedger()
    try:
        if to_snapshot_id:
            row = memory.get_snapshot(to_snapshot_id)
        else:
            row = memory.latest_stable_snapshot()

        if not row:
            return {"ok": False, "error": "no_stable_snapshot"}

        snap_path = Path(row["path"])
        if not snap_path.is_file():
            return {"ok": False, "error": "snapshot_file_missing", "path": str(snap_path)}

        policy = _load_yaml_text(snap_path.read_text(encoding="utf-8"))
        target = data_dir() / "policy.effective.yml"
        save_policy(policy, target)
        ph = policy_hash(policy)
        audit_core = {
            "event": "POLICY_ROLLBACK",
            "snapshot_id": row["id"],
            "policy_hash": ph,
            "timestamp": _utc_now(),
        }
        evidence = sha256_hex(json.dumps(audit_core, sort_keys=True))
        memory.record_policy_audit(
            patch_id=f"rollback_{row['id']}",
            before_hash=row["policy_hash"],
            after_hash=ph,
            reason="rollback_to_stable",
            diff={"snapshot_id": row["id"]},
        )
        return {
            "ok": True,
            "snapshot_id": row["id"],
            "policy_path": str(target),
            "policy_hash": ph,
            "rollback_uar": evidence,
        }
    finally:
        memory.close()


def main() -> int:
    import argparse
    import sys

    parser = argparse.ArgumentParser(description="Nexus Shield policy evolution (local-only)")
    sub = parser.add_subparsers(dest="cmd", required=True)

    sub.add_parser("evolve", help="Run one evolution cycle if thresholds are met")
    rb = sub.add_parser("rollback", help="Rollback policy to last stable snapshot")
    rb.add_argument("--snapshot", default=None, help="Optional snapshot id")

    args = parser.parse_args()
    if args.cmd == "rollback":
        result = rollback_policy(to_snapshot_id=args.snapshot)
        print(json.dumps(result, indent=2))
        return 0 if result.get("ok") else 1

    engine = PolicyEvolutionEngine()
    result = engine.evolve(reason="manual", endpoint_reachable=False)
    print(json.dumps(result or {"evolved": False}, indent=2))
    engine.memory.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
