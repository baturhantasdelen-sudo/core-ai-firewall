"""
Shared preset -> UAR proof builder for Detect & Demonstrate simulations.
"""

from __future__ import annotations

import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
HARNESS = ROOT / "harness"
PRESETS_DIR = ROOT / "presets"
MANIFEST_PATH = PRESETS_DIR / "manifest.json"
PUBLIC_DEMO_DIR = ROOT / "nexus-shield-dashboard" / "public" / "demo"
PUBLIC_PRESETS_DIR = PUBLIC_DEMO_DIR / "presets"
PUBLIC_INDEX = PUBLIC_DEMO_DIR / "cve-presets-index.json"
LEGACY_PROOF_JSON = PUBLIC_DEMO_DIR / "independent-verification-proof.json"

VERIFY_BASE = "https://nexus-shield-dashboard.vercel.app/verify"
REPORT_URL = "https://www.nexusshield.ai/reports/state-of-agent-security-2026"
RUNTIME_BENCHMARK = "P99 runtime intercept: 6.1ms (Nexus benchmark harness)"
RECEIPT_NAMESPACE = "nexus-shield-preset:v1"


def load_evaluate():
    sys.path.insert(0, str(HARNESS))
    from core.policy_engine import evaluate_proposed_action  # noqa: WPS433

    return evaluate_proposed_action


def deterministic_receipt_id(preset_id: str) -> str:
    digest = hashlib.sha256(f"{RECEIPT_NAMESPACE}:{preset_id}".encode("utf-8")).hexdigest()
    return f"uar_{digest[:32]}"


def load_manifest() -> dict[str, Any]:
    return json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))


def load_preset_definition(preset_id: str) -> dict[str, Any]:
    manifest = load_manifest()
    entry = next((p for p in manifest["presets"] if p["preset_id"] == preset_id), None)
    if not entry:
        known = ", ".join(p["preset_id"] for p in manifest["presets"])
        raise KeyError(f"Unknown preset_id {preset_id!r}. Known: {known}")
    path = PRESETS_DIR / entry["file"]
    data = json.loads(path.read_text(encoding="utf-8"))
    if data.get("preset_id") != preset_id:
        raise ValueError(f"Preset file {path.name} preset_id mismatch")
    return data


def build_proof_from_preset(preset: dict[str, Any]) -> dict[str, Any]:
    evaluate = load_evaluate()
    preset_id = preset["preset_id"]
    evaluation = evaluate(
        agent_id=preset["agent_id"],
        intent=preset["user_intent"],
        tool=preset["tool"],
        params=preset.get("params") or {},
        identity_verified=bool(preset.get("identity_verified", True)),
        receipt_id=deterministic_receipt_id(preset_id),
        timestamp_utc=preset["receipt_anchor_utc"],
    )
    receipt = evaluation["receipt"]
    evidence_hash = receipt["evidence_bundle_hash"]
    receipt_id = receipt["receipt_id"]
    verify_url = f"{VERIFY_BASE}?receipt_hash={evidence_hash}&receipt_id={receipt_id}"

    return {
        "demo_id": f"preset-{preset_id}",
        "preset_id": preset_id,
        "cve_label": preset.get("cve_label"),
        "title": preset.get("title"),
        "severity": preset.get("severity"),
        "generated_at_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "positioning": "Agent Action Governance & Verification",
        "runtime_benchmark": RUNTIME_BENCHMARK,
        "report_url": REPORT_URL,
        "scenario": {
            "target": preset["target"],
            "agent_id": preset["agent_id"],
            "user_intent": preset["user_intent"],
            "proposed_tool": preset["tool"],
            "proposed_params": preset.get("params") or {},
            "attack_vector": preset["attack_vector"],
        },
        "mitigation": {
            "decision": evaluation["decision"],
            "rule_id": evaluation["rule_id"],
            "risk_score": evaluation["risk_score"],
            "violations": evaluation["violations"],
            "summary": (
                f"Runtime Action Governance intercepted the tool call with decision "
                f"{evaluation['decision']} ({RUNTIME_BENCHMARK})."
            ),
        },
        "universal_action_receipt": receipt,
        "evidence_bundle_sha256": evidence_hash,
        "receipt_id": receipt_id,
        "verification_url": verify_url,
    }


def build_public_index(proofs: dict[str, dict[str, Any]]) -> dict[str, Any]:
    manifest = load_manifest()
    presets_out = []
    for entry in manifest["presets"]:
        pid = entry["preset_id"]
        proof = proofs[pid]
        presets_out.append(
            {
                "preset_id": pid,
                "cve_label": entry.get("cve_label"),
                "title": entry.get("title"),
                "severity": entry.get("severity"),
                "decision": proof["mitigation"]["decision"],
                "evidence_bundle_sha256": proof["evidence_bundle_sha256"],
                "receipt_id": proof["receipt_id"],
                "verification_url": proof["verification_url"],
                "proof_bundle_path": f"/demo/presets/{pid}.proof.json",
            }
        )
    return {
        "schema_version": manifest["schema_version"],
        "framework": manifest["framework"],
        "default_preset_id": manifest["default_preset_id"],
        "runtime_benchmark": RUNTIME_BENCHMARK,
        "report_url": REPORT_URL,
        "presets": presets_out,
    }


def write_public_artifacts(proofs: dict[str, dict[str, Any]]) -> None:
    PUBLIC_PRESETS_DIR.mkdir(parents=True, exist_ok=True)
    for pid, proof in proofs.items():
        out = PUBLIC_PRESETS_DIR / f"{pid}.proof.json"
        out.write_text(json.dumps(proof, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    index = build_public_index(proofs)
    PUBLIC_INDEX.write_text(json.dumps(index, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    default_id = index["default_preset_id"]
    LEGACY_PROOF_JSON.write_text(
        json.dumps(proofs[default_id], indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )


def print_cli_report(payload: dict[str, Any], *, banner: bool = True) -> None:
    if banner:
        print("\n=== Nexus Shield - Vulnerability Preset Simulation ===\n")
    print(f"Preset:     {payload.get('preset_id')} ({payload.get('cve_label')})")
    print(f"Title:      {payload.get('title')}")
    print(f"Target:     {payload['scenario']['target']}")
    print(f"Attack:     {payload['scenario']['attack_vector']}")
    print(f"Decision:   {payload['mitigation']['decision']} (rule {payload['mitigation']['rule_id']})")
    print(f"Receipt ID: {payload['receipt_id']}")
    print(f"SHA-256:    {payload['evidence_bundle_sha256']}")
    print(f"\nIndependent verify URL:\n{payload['verification_url']}\n")
