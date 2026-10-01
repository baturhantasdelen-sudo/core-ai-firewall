"""Local-first memory ledger and policy evolution tests."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from nexus.evolution import PolicyEvolutionEngine, load_policy, policy_hash, rollback_policy, save_policy
from nexus.memory import LocalMemoryLedger


@pytest.fixture
def isolated_nexus(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    data = tmp_path / "data"
    data.mkdir()
    monkeypatch.setenv("NEXUS_DATA_DIR", str(data))
    monkeypatch.setenv("NEXUS_REPO_ROOT", str(tmp_path))
    seed = tmp_path / "nexus"
    seed.mkdir()
    policy = seed / "policy.yml"
    policy.write_text(
        """
version: 1
high_risk_tools: [export_customer_database]
blocked_tools: []
allowed_tools: []
require_approval_tools: []
block_risk_threshold: 85
anomaly:
  blocked_window_minutes: 60
  blocked_count_threshold: 2
  false_positive_threshold: 1
evolution:
  enabled: true
  patch_on_endpoint_unreachable: true
""".strip(),
        encoding="utf-8",
    )
    monkeypatch.setenv("NEXUS_POLICY_PATH", str(data / "policy.effective.yml"))
    save_policy(load_policy(policy), data / "policy.effective.yml")
    return tmp_path


def test_memory_records_encrypted_events(isolated_nexus: Path) -> None:
    ledger = LocalMemoryLedger()
    try:
        eid = ledger.record_action(
            decision="BLOCK",
            tool="export_customer_database",
            intent="Export prod",
            uar_receipt_id="abc123",
            endpoint_reachable=False,
        )
        assert eid.startswith("mem_")
        stats = ledger.stats()
        assert stats.total_events >= 1
    finally:
        ledger.close()


def test_evolution_patches_on_unreachable(isolated_nexus: Path) -> None:
    ledger = LocalMemoryLedger()
    engine = PolicyEvolutionEngine(memory=ledger)
    try:
        ledger.record_action(
            decision="BLOCK",
            tool="export_customer_database",
            intent="Export prod",
            uar_receipt_id="h1",
            endpoint_reachable=False,
        )
        result = engine.evolve(reason="test", endpoint_reachable=False)
        assert result is not None
        assert len(result["policy_audit_uar"]) == 64
        policy = load_policy()
        assert "export_customer_database" in (policy.get("high_risk_tools") or [])
    finally:
        ledger.close()


def test_rollback_restores_stable_snapshot(isolated_nexus: Path) -> None:
    ledger = LocalMemoryLedger()
    engine = PolicyEvolutionEngine(memory=ledger)
    try:
        before = load_policy()
        engine._snapshot_policy(before, stable=True)
        mutated = dict(before)
        mutated["blocked_tools"] = ["safe_tool"]
        save_policy(mutated)
        rb = rollback_policy()
        assert rb.get("ok") is True
        restored = load_policy()
        assert "safe_tool" not in (restored.get("blocked_tools") or [])
    finally:
        ledger.close()


def test_policy_hash_stable() -> None:
    payload = {"version": 1, "blocked_tools": ["a"]}
    assert policy_hash(payload) == policy_hash(json.loads(json.dumps(payload)))
