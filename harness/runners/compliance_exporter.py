#!/usr/bin/env python3
"""
Build SOC 2 / ISO 27001 oriented compliance evidence from harness artifacts.

Usage:
    python -m runners.compliance_exporter
    python -m runners.compliance_exporter --output-dir results/compliance
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import time
from pathlib import Path
from typing import Any

from runners.owasp_mapping import runtime_privacy_payload, standards_alignment_payload

ROOT = Path(__file__).resolve().parents[1]

DEFAULT_LEADERBOARD = ROOT / "results" / "mcp_leaderboard.json"
DEFAULT_SCORECARD = ROOT / "results" / "scorecard_2026.json"

# Automated GRC control mapping (evidence pointers — not a certification claim).
CONTROL_CATALOG: list[dict[str, str]] = [
    {
        "framework": "SOC 2",
        "control_id": "CC7.1",
        "control_name": "Vulnerability management — detection & monitoring",
        "evidence_key": "mcp_benchmark.block_rate_pct",
    },
    {
        "framework": "SOC 2",
        "control_id": "CC7.2",
        "control_name": "Security event response — malicious agent actions",
        "evidence_key": "mcp_benchmark.blocked_count",
    },
    {
        "framework": "SOC 2",
        "control_id": "CC6.6",
        "control_name": "Logical access — excessive agency / tool abuse",
        "evidence_key": "owasp_coverage.scenario_count",
    },
    {
        "framework": "ISO 27001:2022",
        "control_id": "A.8.8",
        "control_name": "Management of technical vulnerabilities",
        "evidence_key": "mcp_benchmark.mcp_sec_score",
    },
    {
        "framework": "ISO 27001:2022",
        "control_id": "A.8.9",
        "control_name": "Configuration management — secure agent defaults",
        "evidence_key": "scorecard.headline_stats.ootb_defense_rate_avg_pct",
    },
    {
        "framework": "ISO 27001:2022",
        "control_id": "A.5.23",
        "control_name": "Information security for use of cloud services",
        "evidence_key": "runtime_privacy.external_cloud_proxy",
    },
    {
        "framework": "Nexus AI Risk",
        "control_id": "AIR-01",
        "control_name": "Agentic AI risk assessment (Shadow AI scorecard)",
        "evidence_key": "scorecard.frameworks_evaluated",
    },
    {
        "framework": "Nexus AI Risk",
        "control_id": "AIR-02",
        "control_name": "OWASP GenAI / Agentic threat taxonomy coverage",
        "evidence_key": "owasp_coverage.unique_genai_tags",
    },
]


def _load_json(path: Path) -> dict[str, Any] | None:
    if not path.is_file():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def _collect_owasp_coverage(leaderboard: dict[str, Any]) -> dict[str, Any]:
    genai: set[str] = set()
    agentic: set[str] = set()
    rows: list[dict[str, Any]] = []

    for scenario in leaderboard.get("scenarios") or leaderboard.get("leaderboard") or []:
        owasp = scenario.get("owasp") or {}
        for tag in owasp.get("owasp_genai_top_10") or []:
            genai.add(tag)
        for tag in owasp.get("owasp_agentic") or []:
            agentic.add(tag)
        rows.append(
            {
                "scenario_id": scenario.get("scenario_id"),
                "name": scenario.get("scenario_name") or scenario.get("name"),
                "blocked": scenario.get("blocked"),
                "mcp_sec_score": scenario.get("mcp_sec_score"),
                "owasp_genai_top_10": owasp.get("owasp_genai_top_10") or [],
                "owasp_agentic": owasp.get("owasp_agentic") or [],
                "evidence_hash": scenario.get("evidence_hash"),
            }
        )

    return {
        "scenario_count": len(rows),
        "unique_genai_tags": sorted(genai),
        "unique_agentic_tags": sorted(agentic),
        "scenarios": rows,
    }


def _scorecard_summary(scorecard: dict[str, Any] | None) -> dict[str, Any]:
    if not scorecard:
        return {
            "present": False,
            "frameworks_evaluated": 0,
            "headline_stats": {},
        }
    headline = scorecard.get("headline_stats") or {}
    return {
        "present": True,
        "report_id": scorecard.get("report_id"),
        "frameworks_evaluated": len(scorecard.get("frameworks") or []),
        "headline_stats": headline,
        "nexus_shield_mitigation_avg_pct": headline.get("nexus_shield_mitigation_avg_pct"),
        "ootb_defense_rate_avg_pct": headline.get("ootb_defense_rate_avg_pct"),
    }


def _resolve_evidence_value(key: str, ctx: dict[str, Any]) -> Any:
    parts = key.split(".")
    node: Any = ctx
    for part in parts:
        if not isinstance(node, dict):
            return None
        node = node.get(part)
    return node


def build_compliance_bundle(
    *,
    leaderboard_path: Path = DEFAULT_LEADERBOARD,
    scorecard_path: Path = DEFAULT_SCORECARD,
) -> dict[str, Any]:
    leaderboard = _load_json(leaderboard_path)
    if not leaderboard:
        raise FileNotFoundError(f"Leaderboard not found: {leaderboard_path}")

    scorecard = _load_json(scorecard_path)
    owasp_coverage = _collect_owasp_coverage(leaderboard)
    scorecard_summary = _scorecard_summary(scorecard)

    mcp_benchmark = {
        "mcp_sec_score": leaderboard.get("mcp_sec_score"),
        "grade": leaderboard.get("grade"),
        "block_rate_pct": leaderboard.get("block_rate_pct"),
        "blocked_count": leaderboard.get("blocked_count"),
        "scenario_count": leaderboard.get("scenario_count"),
        "timestamp_utc": leaderboard.get("timestamp_utc"),
        "latency_ms": leaderboard.get("latency_ms"),
        "meets_proof_center_baseline": (leaderboard.get("baseline_comparison") or {}).get(
            "meets_baseline"
        ),
    }

    ctx = {
        "mcp_benchmark": mcp_benchmark,
        "scorecard": scorecard_summary,
        "owasp_coverage": owasp_coverage,
        "runtime_privacy": leaderboard.get("runtime_privacy") or runtime_privacy_payload(),
    }

    control_results: list[dict[str, Any]] = []
    for control in CONTROL_CATALOG:
        value = _resolve_evidence_value(control["evidence_key"], ctx)
        status = "pass" if value not in (None, "", 0, False) else "needs_review"
        if control["evidence_key"] == "runtime_privacy.external_cloud_proxy" and value is False:
            status = "pass"
        control_results.append(
            {
                **control,
                "evidence_value": value,
                "status": status,
                "collected_at_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            }
        )

    bundle_core = {
        "bundle_id": "nexusshield-compliance-evidence",
        "bundle_version": "1.0.0",
        "generated_at_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "producer": "nexus-shield-harness/compliance_exporter",
        "standards_alignment": leaderboard.get("standards_alignment") or standards_alignment_payload(),
        "runtime_privacy": ctx["runtime_privacy"],
        "mcp_benchmark": mcp_benchmark,
        "scorecard": scorecard_summary,
        "owasp_coverage": owasp_coverage,
        "automated_controls": control_results,
        "source_artifacts": {
            "mcp_leaderboard": str(leaderboard_path.relative_to(ROOT))
            if leaderboard_path.is_relative_to(ROOT)
            else str(leaderboard_path),
            "scorecard_2026": str(scorecard_path.relative_to(ROOT))
            if scorecard_path.is_file() and scorecard_path.is_relative_to(ROOT)
            else (str(scorecard_path) if scorecard_path.is_file() else None),
        },
        "integrations": {
            "vanta_drata_secureframe": {
                "ingest_method": "HTTPS GET polling",
                "recommended_path": "/api/v1/compliance/evidence",
                "auth": "x-api-key or x-compliance-monitor-token",
                "formats": ["json", "csv"],
            }
        },
    }

    digest = hashlib.sha256(json.dumps(bundle_core, sort_keys=True).encode("utf-8")).hexdigest()
    bundle_core["integrity"] = {"sha256": digest}

    return bundle_core


def write_csv_controls(bundle: dict[str, Any], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    rows = bundle.get("automated_controls") or []
    fieldnames = [
        "framework",
        "control_id",
        "control_name",
        "status",
        "evidence_value",
        "evidence_key",
        "collected_at_utc",
    ]
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow({key: row.get(key, "") for key in fieldnames})


def write_csv_scenarios(bundle: dict[str, Any], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    scenarios = (bundle.get("owasp_coverage") or {}).get("scenarios") or []
    fieldnames = [
        "scenario_id",
        "name",
        "blocked",
        "mcp_sec_score",
        "owasp_genai_top_10",
        "owasp_agentic",
        "evidence_hash",
    ]
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for row in scenarios:
            writer.writerow(
                {
                    "scenario_id": row.get("scenario_id"),
                    "name": row.get("name"),
                    "blocked": row.get("blocked"),
                    "mcp_sec_score": row.get("mcp_sec_score"),
                    "owasp_genai_top_10": "; ".join(row.get("owasp_genai_top_10") or []),
                    "owasp_agentic": "; ".join(row.get("owasp_agentic") or []),
                    "evidence_hash": row.get("evidence_hash"),
                }
            )


def export_bundle(
    *,
    output_dir: Path,
    leaderboard_path: Path,
    scorecard_path: Path,
) -> dict[str, Any]:
    bundle = build_compliance_bundle(
        leaderboard_path=leaderboard_path,
        scorecard_path=scorecard_path,
    )
    output_dir.mkdir(parents=True, exist_ok=True)
    json_path = output_dir / "compliance_evidence_bundle.json"
    json_path.write_text(json.dumps(bundle, indent=2), encoding="utf-8")
    write_csv_controls(bundle, output_dir / "compliance_controls.csv")
    write_csv_scenarios(bundle, output_dir / "compliance_scenarios.csv")
    return {"json": str(json_path), "bundle_id": bundle["bundle_id"], "sha256": bundle["integrity"]["sha256"]}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Export Nexus Shield compliance evidence bundle")
    parser.add_argument(
        "--leaderboard",
        default=str(DEFAULT_LEADERBOARD),
        help="Path to mcp_leaderboard.json",
    )
    parser.add_argument(
        "--scorecard",
        default=str(DEFAULT_SCORECARD),
        help="Path to scorecard_2026.json (optional)",
    )
    parser.add_argument(
        "--output-dir",
        default=str(ROOT / "results" / "compliance"),
        help="Directory for JSON/CSV exports",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    summary = export_bundle(
        output_dir=Path(args.output_dir),
        leaderboard_path=Path(args.leaderboard),
        scorecard_path=Path(args.scorecard),
    )
    print(json.dumps({"status": "ok", **summary}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
