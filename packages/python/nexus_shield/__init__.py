"""Nexus Shield Security Engine — in-RAM PII guardrail proxy (Agent Action Governance is the primary platform)."""

__version__ = "0.2.0"

from .action_receipt import build_action_receipt, inspect_action

__all__ = ["NexusClient", "build_action_receipt", "inspect_action", "__version__"]


class NexusClient:
    """Lightweight client config helper for Nexus Shield /v1/shield proxy routes."""

    def __init__(self, base_url: str = "http://localhost:8080/v1", api_key: str | None = None):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key

    def get_proxy_config(self) -> dict[str, object]:
        headers: dict[str, str] = {}
        if self.api_key:
            headers["X-API-Key"] = self.api_key
        return {
            "base_url": self.base_url,
            "headers": headers,
        }
