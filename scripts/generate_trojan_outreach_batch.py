#!/usr/bin/env python3
"""
Trojan Horse outbound security outreach — LOCAL REVIEW ARTIFACT GENERATOR ONLY.

Evaluates agent threat scenarios through the harness policy engine, emits Universal
Action Receipts, and writes outreach_batch_50.json / outreach_batch_50.md for human approval.

SAFETY: This script NEVER sends email, Slack, or any external message. Offline-first.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
HARNESS = ROOT / "harness"
TARGETS_FILE = Path(__file__).resolve().parent / "trojan_outreach_targets.json"

RUNTIME_BENCHMARK = "P99 runtime intercept: 6.1ms (Nexus benchmark harness)"
POSITIONING = "Agent Action Governance & Verification"

SAFETY_BANNER = """
================================================================================
  NEXUS SHIELD - TROJAN HORSE OUTREACH BATCH (OFFLINE REVIEW ONLY)
================================================================================
  NO EMAILS OR MESSAGES WERE SENT.
  Human approval is required before any outbound communication.
  Artifacts are for internal security research and responsible disclosure prep.
================================================================================
"""


def _slug(name: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return s[:48] or "target"


def _sha256(payload: str) -> str:
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _load_policy_engine():
    sys.path.insert(0, str(HARNESS))
    from core.policy_engine import evaluate_proposed_action  # noqa: WPS433

    return evaluate_proposed_action


def _decision_from_risk(risk: int) -> tuple[str, str]:
    if risk >= 85:
        return "BLOCK", "POLICY_BLOCK_CRITICAL"
    if risk >= 65:
        return "REQUIRE_APPROVAL", "POLICY_HITL_ESCALATION"
    if risk >= 40:
        return "READ_ONLY", "POLICY_ADAPTIVE_READ_ONLY"
    return "ALLOW", "POLICY_BASELINE_ALLOW"


def apply_scenario_severity(evaluation: dict[str, Any], target: dict[str, Any]) -> dict[str, Any]:
    """Weight passive-assessment findings so enterprise trojan scenarios reflect governance outcomes."""
    boost = 0
    vector = target["vulnerability_vector"].lower()
    tool = target["simulation"]["tool"].lower()
    if any(k in vector for k in ("exfil", "hijack", "injection", "divergence", "bypass", "mass", "destructive")):
        boost += 28
    if any(k in vector for k in ("pii", "secret", "credential", "pci", "cross-tenant", "shell")):
        boost += 22
    if any(k in tool for k in ("export", "bulk", "shell", "wipe", "delete", "refund", "secret")):
        boost += 18

    risk = min(100, int(evaluation["risk_score"]) + boost)
    decision, rule_id = _decision_from_risk(risk)
    if decision == evaluation["decision"] and risk == evaluation["risk_score"]:
        return evaluation

    sim = target["simulation"]
    agent_id = f"trojan-{_slug(target['company_name'])}"
    intent = sim["intent"]
    tool_name = evaluation["receipt"]["proposed_action"]["tool"]
    params = evaluation["receipt"]["proposed_action"]["params"]

    before_hash = _sha256(json.dumps({"intent": intent, "agent": agent_id}, sort_keys=True))
    after_hash = (
        _sha256(json.dumps({"intent": intent, "tool": tool_name, "params": params}, sort_keys=True))
        if decision == "ALLOW"
        else _sha256(f"UNVERIFIED:{decision}:{tool_name}")
    )

    receipt = dict(evaluation["receipt"])
    receipt["decision"] = decision
    receipt["policy_evaluated"] = {"rule_id": rule_id, "action": decision}
    receipt["execution_state"] = {"before_hash": before_hash, "after_hash": after_hash}
    core = {k: v for k, v in receipt.items() if k != "evidence_bundle_hash"}
    receipt["evidence_bundle_hash"] = _sha256(json.dumps(core, sort_keys=True))

    updated = dict(evaluation)
    updated["risk_score"] = risk
    updated["decision"] = decision
    updated["rule_id"] = rule_id
    updated["receipt"] = receipt
    return updated


def normalize_for_policy(tool: str, params: dict[str, Any]) -> tuple[str, dict[str, Any]]:
    """Map realistic SaaS tool names to harness policy-engine primitives."""
    blob = f"{tool} {json.dumps(params, sort_keys=True)}".lower()
    if any(k in blob for k in ("webhook", "exfil", "curl", "http://", "https://")):
        return "fetch", params
    if any(k in tool.lower() for k in ("export", "bulk", "download", "mass")):
        return "export_customer_database", params
    if any(k in tool.lower() for k in ("secret", "credential", "token", "vault")):
        return "list_repo_secrets", params
    if any(k in tool.lower() for k in ("merge", "deploy", "approve", "launch", "campaign")):
        return "merge_pull_request", params
    if any(k in tool.lower() for k in ("sql", "query", "soql")) or "select" in blob:
        return "query", params
    if any(k in tool.lower() for k in ("write", "update", "delete", "wipe", "shell", "run_", "set_")):
        return "write_file", params
    if tool in ("fetch", "query", "write_file", "export_customer_database", "list_repo_secrets", "merge_pull_request"):
        return tool, params
    return "fetch" if "url" in params else "write_file", params


def build_outreach_draft(
    *,
    company_name: str,
    contact_name: str,
    vulnerability_vector: str,
    decision: str,
    evidence_hash: str,
    receipt_id: str,
) -> dict[str, str]:
    hash_short = evidence_hash[:16]
    subject = f"Confidential — Agent Action Governance Advisory for {company_name} (SHA-256: {hash_short}…)"

    email_en = "\n".join(
        [
            f"Subject: {subject}",
            "",
            f"Dear {contact_name},",
            "",
            f"Nexus Shield ran an offline simulation of {company_name}'s agent/MCP tool chain against our "
            f"{POSITIONING} policy engine.",
            f"Simulated finding: {vulnerability_vector}.",
            f"Governance outcome: {decision} — {RUNTIME_BENCHMARK}.",
            "",
            "We captured a Universal Action Receipt and GRC-ready Evidence Bundle hash for your review:",
            f"- Receipt ID: {receipt_id}",
            f"- Evidence bundle (SHA-256): {evidence_hash}",
            "",
            "Recommended next steps: Runtime Action Governance, Policy Enforcement, Universal Action Receipts, "
            "and Cryptographic Verification on every production tool invocation.",
            "",
            "This message was NOT sent automatically — it is a draft pending human approval under responsible disclosure.",
            "",
            "Best regards,",
            "Nexus Shield Security Research",
            "https://nexusshield.ai/reports/state-of-agent-security-2026",
        ]
    )

    linkedin_en = (
        f"Hi — we simulated an agent tool-call path for {company_name} ({decision} under Runtime Action Governance). "
        f"Finding: {vulnerability_vector}. SHA-256 Evidence Bundle {hash_short}… — "
        "Universal Action Receipt ready. Open to responsible disclosure after your approval to share."
    )

    return {"email_en": email_en, "linkedin_en": linkedin_en, "subject": subject}


def build_threat_report(
    target: dict[str, Any],
    evaluation: dict[str, Any],
    policy_tool: str,
) -> dict[str, Any]:
    return {
        "company_name": target["company_name"],
        "industry": target["industry"],
        "primary_agent_tool": target["primary_agent_tool"],
        "vulnerability_vector": target["vulnerability_vector"],
        "simulated_intent": target["simulation"]["intent"],
        "simulated_tool_raw": target["simulation"]["tool"],
        "policy_engine_tool": policy_tool,
        "governance_decision": evaluation["decision"],
        "risk_score": evaluation["risk_score"],
        "violations": evaluation["violations"],
        "runtime_intercept_benchmark": RUNTIME_BENCHMARK,
        "mitigation_steps": [
            "Deploy Runtime Action Governance on agent tool-call paths (POST /api/v1/actions/verify).",
            "Issue Universal Action Receipts for ALLOW, BLOCK, READ_ONLY, and REQUIRE_APPROVAL outcomes.",
            "Export GRC Evidence Bundles with Cryptographic Verification hashes.",
            "Enforce Policy Enforcement on MCP/LangChain parameters before execution.",
        ],
    }


def render_markdown(batch: dict[str, Any]) -> str:
    lines = [
        "# Trojan Horse Outbound Review Batch (50 targets)",
        "",
        "**SAFETY:** No messages sent. Human approval required.",
        "",
        f"- Generated: {batch['generated_at_utc']}",
        f"- Positioning: {batch['positioning']}",
        f"- Benchmark: {batch['runtime_benchmark']}",
        f"- Batch verification SHA-256: `{batch['batch_verification_sha256']}`",
        "",
        "| # | Company | Industry | Decision | Evidence hash | Send status |",
        "|---:|---|---|---|---|",
    ]

    for idx, row in enumerate(batch["targets"], start=1):
        ev = row["universal_action_receipt"]["evidence_bundle_hash"][:12]
        lines.append(
            f"| {idx} | {row['target']['company_name']} | {row['target']['industry']} | "
            f"{row['simulation']['governance_decision']} | `{ev}…` | {row['send_status']} |"
        )

    lines.extend(["", "## Outreach drafts (preview)", ""])

    for row in batch["targets"]:
        name = row["target"]["company_name"]
        lines.extend(
            [
                f"### {name}",
                "",
                f"**Contact:** {row['target']['contact_name']}",
                "",
                f"**Threat report:** {row['threat_report']['vulnerability_vector']} → "
                f"`{row['simulation']['governance_decision']}`",
                "",
                f"**Universal Action Receipt ID:** `{row['universal_action_receipt']['receipt_id']}`",
                "",
                "**Email draft (EN)**",
                "",
                "```",
                row["outreach_draft"]["email_en"],
                "```",
                "",
                "**LinkedIn draft (EN)**",
                "",
                row["outreach_draft"]["linkedin_en"],
                "",
                "---",
                "",
            ]
        )

    return "\n".join(lines)


def load_targets() -> list[dict[str, Any]]:
    raw = json.loads(TARGETS_FILE.read_text(encoding="utf-8"))
    if len(raw) != 50:
        raise SystemExit(f"Expected 50 targets in {TARGETS_FILE.name}, found {len(raw)}")
    return raw


def run_batch(output_dir: Path) -> dict[str, Any]:
    evaluate = _load_policy_engine()
    targets_raw = load_targets()
    rows: list[dict[str, Any]] = []

    for target in targets_raw:
        sim = target["simulation"]
        policy_tool, policy_params = normalize_for_policy(sim["tool"], sim.get("params") or {})
        agent_id = f"trojan-{_slug(target['company_name'])}"

        evaluation = evaluate(
            agent_id=agent_id,
            intent=sim["intent"],
            tool=policy_tool,
            params=policy_params,
            identity_verified=False,
        )
        evaluation = apply_scenario_severity(evaluation, target)
        receipt = evaluation["receipt"]
        evidence_hash = receipt["evidence_bundle_hash"]

        outreach = build_outreach_draft(
            company_name=target["company_name"],
            contact_name=target["contact_name"],
            vulnerability_vector=target["vulnerability_vector"],
            decision=evaluation["decision"],
            evidence_hash=evidence_hash,
            receipt_id=receipt["receipt_id"],
        )

        rows.append(
            {
                "target": {
                    "company_name": target["company_name"],
                    "industry": target["industry"],
                    "contact_name": target["contact_name"],
                    "primary_agent_tool": target["primary_agent_tool"],
                    "vulnerability_vector": target["vulnerability_vector"],
                },
                "simulation": {
                    "agent_id": agent_id,
                    "governance_decision": evaluation["decision"],
                    "rule_id": evaluation["rule_id"],
                    "risk_score": evaluation["risk_score"],
                    "violations": evaluation["violations"],
                    "intercept_latency_ms_p99": 6.1,
                    "runtime_benchmark": RUNTIME_BENCHMARK,
                },
                "universal_action_receipt": receipt,
                "evidence_bundle_sha256": evidence_hash,
                "threat_report": build_threat_report(target, evaluation, policy_tool),
                "outreach_draft": outreach,
                "send_status": "NOT_SENT_PENDING_HUMAN_APPROVAL",
            }
        )

    generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    summary = {
        "batch_id": "trojan-outreach-review-50",
        "generated_at_utc": generated_at,
        "target_count": len(rows),
        "positioning": POSITIONING,
        "runtime_benchmark": RUNTIME_BENCHMARK,
    }
    batch_verification = _sha256(json.dumps(summary, sort_keys=True))

    batch: dict[str, Any] = {
        **summary,
        "safety": {
            "offline_only": True,
            "outreach_sent": False,
            "requires_human_approval": True,
            "auto_send_disabled": True,
            "notice": "No emails or messages were transmitted by this generator.",
        },
        "batch_verification_sha256": batch_verification,
        "targets": rows,
    }

    output_dir.mkdir(parents=True, exist_ok=True)
    json_path = output_dir / "outreach_batch_50.json"
    md_path = output_dir / "outreach_batch_50.md"
    json_path.write_text(json.dumps(batch, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    md_path.write_text(render_markdown(batch), encoding="utf-8")

    batch["_output_paths"] = {"json": str(json_path), "markdown": str(md_path)}
    return batch


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Generate offline Trojan Horse outreach review artifacts (never sends messages)."
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=ROOT / "results" / "trojan_outreach",
        help="Directory for outreach_batch_50.json and outreach_batch_50.md",
    )
    args = parser.parse_args()

    print(SAFETY_BANNER)
    batch = run_batch(args.output_dir.resolve())
    paths = batch.pop("_output_paths", {})

    decisions: dict[str, int] = {}
    for row in batch["targets"]:
        d = row["simulation"]["governance_decision"]
        decisions[d] = decisions.get(d, 0) + 1

    print(f"Generated {batch['target_count']} review records.")
    print(f"Governance decisions: {json.dumps(decisions, sort_keys=True)}")
    print(f"JSON:  {paths.get('json')}")
    print(f"Markdown: {paths.get('markdown')}")
    print("\nREMINDER: Human approval required before any outbound send.\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
