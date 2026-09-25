"""Map harness scenarios and violations to OWASP GenAI Top 10 and Agentic AI threat IDs."""

from __future__ import annotations

from typing import Any

OWASP_REFERENCES: list[dict[str, str]] = [
    {
        "title": "OWASP Top 10 for LLM Applications (GenAI)",
        "url": "https://genai.owasp.org/llmrisk/llm01-prompt-injection/",
    },
    {
        "title": "OWASP Agentic AI — Threats and Mitigations",
        "url": "https://owasp.org/www-project-agentic-ai/",
    },
    {
        "title": "OWASP AI Agent Security Cheat Sheet",
        "url": "https://cheatsheetseries.owasp.org/cheatsheets/AI_Agent_Security_Cheat_Sheet.html",
    },
]

CATEGORY_MAP: dict[str, dict[str, list[str]]] = {
    "INDIRECT_PROMPT_INJECTION": {
        "owasp_genai_top_10": ["LLM01:2025 Prompt Injection"],
        "owasp_agentic": ["ASI-01: Agent Goal / Parameter Hijacking"],
    },
    "CROSS_TOOL_EXFILTRATION": {
        "owasp_genai_top_10": ["LLM02:2025 Sensitive Information Disclosure", "LLM06:2025 Excessive Agency"],
        "owasp_agentic": ["ASI-02: Cross-Tool Data Leakage", "ASI-04: Unsafe Tool Chaining"],
    },
    "PRIVILEGE_ESCALATION": {
        "owasp_genai_top_10": ["LLM06:2025 Excessive Agency", "LLM05:2025 Improper Output Handling"],
        "owasp_agentic": ["ASI-03: Permission & Scope Violation"],
    },
    "MCP_HIJACK": {
        "owasp_genai_top_10": ["LLM01:2025 Prompt Injection", "LLM06:2025 Excessive Agency"],
        "owasp_agentic": ["ASI-01: Agent Goal / Parameter Hijacking"],
    },
}

VIOLATION_RULES: list[tuple[str, dict[str, list[str]]]] = [
    (
        r"EXFIL|webhook|SELECT \* FROM",
        {
            "owasp_genai_top_10": ["LLM02:2025 Sensitive Information Disclosure"],
            "owasp_agentic": ["ASI-02: Cross-Tool Data Leakage"],
        },
    ),
    (
        r"HIGH_RISK_TOOL|HIJACK",
        {
            "owasp_genai_top_10": ["LLM06:2025 Excessive Agency"],
            "owasp_agentic": ["ASI-01: Agent Goal / Parameter Hijacking"],
        },
    ),
    (
        r"INJECTION|ignore prior|SYSTEM:",
        {
            "owasp_genai_top_10": ["LLM01:2025 Prompt Injection"],
            "owasp_agentic": ["ASI-01: Agent Goal / Parameter Hijacking"],
        },
    ),
]


def _merge_tags(base: dict[str, list[str]], extra: dict[str, list[str]]) -> dict[str, list[str]]:
    genai = list(dict.fromkeys([*base.get("owasp_genai_top_10", []), *extra.get("owasp_genai_top_10", [])]))
    agentic = list(dict.fromkeys([*base.get("owasp_agentic", []), *extra.get("owasp_agentic", [])]))
    return {"owasp_genai_top_10": genai, "owasp_agentic": agentic}


def classify_threat(*, category: str, violations: list[str] | None = None) -> dict[str, Any]:
    import re

    normalized = category.upper().replace(" ", "_")
    base = CATEGORY_MAP.get(normalized, CATEGORY_MAP["MCP_HIJACK"])
    merged = {"owasp_genai_top_10": list(base["owasp_genai_top_10"]), "owasp_agentic": list(base["owasp_agentic"])}

    blob = " ".join(violations or [])
    for pattern, tags in VIOLATION_RULES:
        if re.search(pattern, blob, re.I):
            merged = _merge_tags(merged, tags)

    return {
        **merged,
        "primary_category": normalized,
        "references": OWASP_REFERENCES,
    }


def standards_alignment_payload() -> dict[str, Any]:
    return {
        "frameworks": ["OWASP GenAI Top 10", "OWASP Agentic AI Threats & Mitigations"],
        "references": OWASP_REFERENCES,
        "compliance_note": (
            "Nexus Shield detections emit OWASP-aligned classification tags for audit export. "
            "Tags indicate mapped threat families; formal certification requires customer GRC review."
        ),
    }


def runtime_privacy_payload() -> dict[str, Any]:
    return {
        "inspection_model": "on_device_sub_millisecond_token_inspection",
        "external_cloud_proxy": False,
        "data_residency": "customer_runtime_boundary",
        "suitable_for": [
            "restricted_enterprise",
            "public_sector",
            "defense_and_critical_infrastructure",
        ],
        "description": (
            "Tool-call and token-level policy evaluation runs locally at the agent runtime boundary "
            "without routing prompts or tool payloads through Nexus Shield cloud proxies."
        ),
    }
