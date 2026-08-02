"""Nexus Shield Python SDK - Sub-10ms In-RAM PII Guardrail Proxy"""

__version__ = "0.1.0"

__all__ = ["NexusClient", "__version__"]


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
