"""
Nexus Shield — local-first self-healing governance (edge memory + policy evolution).

All data stays on-device; no outbound telemetry from this package.
"""

from nexus.action_shield import ActionShield
from nexus.evolution import PolicyEvolutionEngine, rollback_policy
from nexus.memory import LocalMemoryLedger

__all__ = [
    "ActionShield",
    "LocalMemoryLedger",
    "PolicyEvolutionEngine",
    "rollback_policy",
]
