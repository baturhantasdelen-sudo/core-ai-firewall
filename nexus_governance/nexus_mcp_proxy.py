from __future__ import annotations

from typing import Any

from nexus_governance.nexus_action_firewall import ActionFirewall, EnforcementDecision


class MCPProxyInspector:
    """MCP JSON-RPC isteklerini yakalar ve filtreler."""

    @staticmethod
    async def inspect_mcp_request(
        mcp_payload: dict[str, Any],
        agent_trust_score: float,
        *,
        divergence_score: float = 0.0,
    ) -> dict[str, Any]:
        method = mcp_payload.get("method")
        params = mcp_payload.get("params", {})

        if method == "tools/call":
            tool_name = params.get("name", "")
            arguments = params.get("arguments", {})

            decision = ActionFirewall.evaluate(
                trust_score=agent_trust_score,
                divergence_score=divergence_score,
                tool_name=tool_name,
                action_params=arguments,
            )

            if decision == EnforcementDecision.BLOCK:
                return {
                    "is_allowed": False,
                    "decision": decision,
                    "error": {
                        "code": -32001,
                        "message": f"Policy Violation: Action '{tool_name}' is blocked by Nexus Shield.",
                    },
                }

            if decision == EnforcementDecision.REQUIRE_HUMAN_APPROVAL:
                return {
                    "is_allowed": False,
                    "decision": decision,
                    "error": {
                        "code": -32002,
                        "message": f"Human approval required for tool '{tool_name}'.",
                    },
                }

            if decision == EnforcementDecision.DEGRADE_READ_ONLY:
                return {
                    "is_allowed": False,
                    "decision": decision,
                    "error": {
                        "code": -32003,
                        "message": f"Agent degraded to read-only; '{tool_name}' is not permitted.",
                    },
                }

        return {"is_allowed": True, "decision": EnforcementDecision.ALLOW}
