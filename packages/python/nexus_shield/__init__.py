"""Nexus Shield Security Engine — in-RAM PII guardrail proxy (Agent Action Governance is the primary platform)."""

__version__ = "0.2.0"

from .action_receipt import build_action_receipt, inspect_action
from .black_box import AgentBlackBox
from .blast_radius import compute_blast_radius, what_if_remove_tool
from .circuit_breaker import AgentCircuitBreaker, RiskSignals, compute_risk_score
from .delegation import DelegationChain, RootAuthority
from .protocol import export_uar_v2_json_schema, validate_uar_protocol_document
from .supply_chain import scan_agent_supply_chain
from .outcome_verifier import verify_outcome
from .passport import AgentPassport, validate_passport
from .uar_verify import build_uar_v2_receipt, verify_receipt_dict

__all__ = [
    "NexusClient",
    "AgentBlackBox",
    "AgentCircuitBreaker",
    "AgentPassport",
    "RiskSignals",
    "build_action_receipt",
    "build_uar_v2_receipt",
    "compute_blast_radius",
    "compute_risk_score",
    "DelegationChain",
    "export_uar_v2_json_schema",
    "RootAuthority",
    "scan_agent_supply_chain",
    "validate_uar_protocol_document",
    "inspect_action",
    "validate_passport",
    "verify_outcome",
    "verify_receipt_dict",
    "what_if_remove_tool",
    "__version__",
]


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
