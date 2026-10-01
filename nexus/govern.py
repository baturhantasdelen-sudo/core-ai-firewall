"""Self-healing verification orchestration (memory + evolution + policy engine)."""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any

from nexus.evolution import PolicyEvolutionEngine, load_policy
from nexus.memory import LocalMemoryLedger


def _repo_root() -> Path:
    from nexus._paths import repo_root

    return repo_root()


def evaluate_offline_action(
    *,
    agent_id: str,
    intent: str,
    tool: str,
    params: dict[str, Any],
) -> tuple[str, str, str, str]:
    root = _repo_root()
    harness_root = root / "harness"
    if harness_root.is_dir() and str(harness_root) not in sys.path:
        sys.path.insert(0, str(harness_root))
    from core.policy_engine import evaluate_proposed_action

    policy = load_policy()
    evaluation = evaluate_proposed_action(
        agent_id=agent_id,
        intent=intent,
        tool=tool,
        params=params,
        identity_verified=False,
        policy_config=policy,
    )
    receipt = evaluation["receipt"]
    decision = str(evaluation["decision"])
    receipt_id = receipt.get("receipt_id") or ""
    evidence = receipt.get("evidence_bundle_hash") or ""
    return receipt_id, evidence, decision, evaluation.get("rule_id") or ""


def record_and_learn(
    *,
    agent_id: str,
    intent: str,
    tool: str,
    params: dict[str, Any],
    decision: str,
    receipt_id: str,
    uar_receipt_id: str,
    endpoint_reachable: bool,
    feedback: str | None = None,
) -> dict[str, Any]:
    memory = LocalMemoryLedger()
    engine = PolicyEvolutionEngine(memory=memory)
    try:
        if feedback == "false_positive":
            memory.mark_false_positive(tool=tool, intent=intent)

        patch = engine.evolve(
            reason="verify_feedback_loop",
            endpoint_reachable=endpoint_reachable,
        )

        event_id = memory.record_action(
            decision=decision,
            tool=tool,
            intent=intent,
            uar_receipt_id=uar_receipt_id or receipt_id,
            receipt_id=receipt_id,
            endpoint_reachable=endpoint_reachable,
            extra={"patch": patch},
        )

        return {
            "memory_event_id": event_id,
            "policy_patch": patch,
            "memory_stats": memory.stats().__dict__,
        }
    finally:
        memory.close()


def run_self_healing_cycle(
    *,
    agent_id: str,
    intent: str,
    tool: str,
    params: dict[str, Any],
    endpoint_reachable: bool,
    feedback: str | None = None,
) -> dict[str, Any]:
    receipt_id, evidence, decision, rule_id = evaluate_offline_action(
        agent_id=agent_id,
        intent=intent,
        tool=tool,
        params=params,
    )
    meta = record_and_learn(
        agent_id=agent_id,
        intent=intent,
        tool=tool,
        params=params,
        decision=decision,
        receipt_id=receipt_id,
        uar_receipt_id=evidence or receipt_id,
        endpoint_reachable=endpoint_reachable,
        feedback=feedback,
    )
    return {
        "receipt_id": receipt_id,
        "uar_receipt_id": evidence or receipt_id,
        "decision": decision,
        "rule_id": rule_id,
        **meta,
    }
