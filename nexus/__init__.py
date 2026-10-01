"""
Nexus Shield — local-first self-healing governance (edge memory + policy evolution).

All data stays on-device; no outbound telemetry from this package.
"""

from nexus.evolution import PolicyEvolutionEngine, rollback_policy
from nexus.memory import LocalMemoryLedger

__all__ = ["LocalMemoryLedger", "PolicyEvolutionEngine", "rollback_policy"]
