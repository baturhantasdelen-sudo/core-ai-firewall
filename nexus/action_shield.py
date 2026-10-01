"""Copy/paste interceptor helper for Python hosts (local-first)."""

from __future__ import annotations

import json
import urllib.error
import urllib.request
from typing import Any


class ActionShield:
    """
    Lightweight sidecar client — every tool proposal goes through governance before execution.

    Example:
        shield = ActionShield(intercept_url="http://127.0.0.1:8090/v1/intercept")
        receipt = shield.intercept("Read invoice", "read_invoice", {"invoice_id": "8291"})
    """

    def __init__(
        self,
        intercept_url: str = "http://127.0.0.1:8090/v1/intercept",
        *,
        agent_id: str = "app:agent-01",
        tenant_id: str = "tnt_default",
        timeout_sec: float = 8.0,
    ) -> None:
        self.intercept_url = intercept_url.rstrip("/")
        if not self.intercept_url.endswith("/v1/intercept"):
            self.intercept_url = f"{self.intercept_url.rstrip('/')}/v1/intercept"
        self.agent_id = agent_id
        self.tenant_id = tenant_id
        self.timeout_sec = timeout_sec

    def intercept(
        self,
        intent: str,
        tool: str,
        params: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        body = json.dumps(
            {
                "tenant_id": self.tenant_id,
                "agent_id": self.agent_id,
                "user_intent": intent,
                "tool": tool,
                "params": params or {},
            }
        ).encode("utf-8")
        req = urllib.request.Request(
            self.intercept_url,
            data=body,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=self.timeout_sec) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.URLError as exc:
            from nexus.govern import evaluate_offline_action

            receipt_id, evidence, decision, rule_id = evaluate_offline_action(
                agent_id=self.agent_id,
                intent=intent,
                tool=tool,
                params=params or {},
            )
            return {
                "decision": decision,
                "offline": True,
                "uar": {
                    "receipt_id": receipt_id,
                    "evidence_hash": evidence,
                    "decision": decision,
                },
                "rule_id": rule_id,
                "error": str(exc),
            }

    def allow(self, receipt: dict[str, Any]) -> bool:
        decision = (receipt.get("decision") or (receipt.get("uar") or {}).get("decision") or "").upper()
        return decision == "ALLOW"
