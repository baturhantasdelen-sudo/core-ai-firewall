"""Public alias for Nexus Shield SDK — use `from nexus import verify_action`."""

from nexus_shield.sdk.verify_action import SecurityException, verify_action

__all__ = ["verify_action", "SecurityException"]
