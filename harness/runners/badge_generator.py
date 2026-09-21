#!/usr/bin/env python3
"""
Generate MCP-Sec Verified badges from results/mcp_leaderboard.json.

Usage:
    python -m runners.badge_generator
    python -m runners.badge_generator --output docs/badges --format all
"""

from __future__ import annotations

import argparse
import json
import urllib.parse
from pathlib import Path
from typing import Any

ADAPTER_LABELS: dict[str, str] = {
    "mcp-hijack-postgres-exfil": "Postgres",
    "mcp-hijack-filesystem-traversal": "FileSystem",
    "mcp-hijack-slack-github-leak": "Slack+GitHub",
    "mcp-hijack-github-pr-poison": "GitHub",
    "mcp-hijack-fetch-ssrf": "Fetch",
}

GRADE_COLORS: dict[str, str] = {
    "A+": "brightgreen",
    "A": "brightgreen",
    "B": "yellow",
    "C": "yellow",
    "D": "orange",
    "F": "red",
}


def load_leaderboard(path: Path) -> dict[str, Any]:
    if not path.is_file():
        raise FileNotFoundError(f"Leaderboard not found: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def shields_badge(label: str, message: str, color: str) -> str:
    encoded_label = urllib.parse.quote(label, safe="")
    encoded_message = urllib.parse.quote(message, safe="")
    return (
        f"https://img.shields.io/badge/{encoded_label}-{encoded_message}-{color}"
        f"?style=flat-square&logo=shield"
    )


def markdown_badge(label: str, message: str, color: str, link: str) -> str:
    url = shields_badge(label, message, color)
    return f"[![{label} {message}]({url})]({link})"


def generate_overall_badge(data: dict[str, Any], proof_url: str) -> str:
    score = data.get("mcp_sec_score", 0)
    grade = data.get("grade", "F")
    color = GRADE_COLORS.get(str(grade), "lightgrey")
    message = f"{score}%20%7C%20Grade%20{grade}"
    url = f"https://img.shields.io/badge/MCP--SEC--SCORE-{message}-{color}?style=flat-square&logo=shield"
    return f"[![MCP-Sec Verified Grade {grade}]({url})]({proof_url})"


def generate_adapter_badges(data: dict[str, Any], proof_url: str) -> list[dict[str, str]]:
    badges: list[dict[str, str]] = []
    for entry in data.get("leaderboard", []):
        scenario_id = str(entry.get("scenario_id", ""))
        label = ADAPTER_LABELS.get(scenario_id, scenario_id)
        grade = str(entry.get("grade", "F"))
        score = entry.get("mcp_sec_score", 0)
        color = GRADE_COLORS.get(grade, "lightgrey")
        md = markdown_badge(f"MCP-Sec {label}", f"{score}%20%7C%20{grade}", color, proof_url)
        badges.append(
            {
                "adapter": label,
                "scenario_id": scenario_id,
                "grade": grade,
                "score": str(score),
                "markdown": md,
                "url": shields_badge(f"MCP-Sec {label}", f"{score} | {grade}", color),
            }
        )
    return badges


def render_markdown_report(
    data: dict[str, Any],
    overall: str,
    adapters: list[dict[str, str]],
    proof_url: str,
) -> str:
    lines = [
        "# MCP-Sec Verified Badges",
        "",
        "## Overall",
        "",
        overall,
        "",
        f"Proof Center: {proof_url}",
        "",
        "## Per-Adapter",
        "",
    ]
    for badge in adapters:
        lines.append(f"### {badge['adapter']} — Grade {badge['grade']} ({badge['score']})")
        lines.append("")
        lines.append(badge["markdown"])
        lines.append("")
        lines.append(f"Direct URL: `{badge['url']}`")
        lines.append("")
    return "\n".join(lines)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate MCP-Sec Verified badges")
    parser.add_argument(
        "--input",
        default="results/mcp_leaderboard.json",
        help="Leaderboard JSON path",
    )
    parser.add_argument(
        "--output",
        default="docs/badges",
        help="Output directory for generated badge files",
    )
    parser.add_argument(
        "--proof-url",
        default="https://nexusshield.ai/docs/benchmark",
        help="Link target for badge clicks",
    )
    parser.add_argument(
        "--format",
        choices=["markdown", "json", "all"],
        default="all",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    harness_root = Path(__file__).resolve().parent.parent
    input_path = Path(args.input)
    if not input_path.is_absolute():
        input_path = harness_root / input_path

    output_dir = Path(args.output)
    if not output_dir.is_absolute():
        output_dir = harness_root / output_dir
    output_dir.mkdir(parents=True, exist_ok=True)

    data = load_leaderboard(input_path)
    overall = generate_overall_badge(data, args.proof_url)
    adapters = generate_adapter_badges(data, args.proof_url)
    report = render_markdown_report(data, overall, adapters, args.proof_url)

    if args.format in {"markdown", "all"}:
        (output_dir / "README.md").write_text(report, encoding="utf-8")
        (output_dir / "overall.md").write_text(overall + "\n", encoding="utf-8")

    if args.format in {"json", "all"}:
        payload = {
            "overall": overall,
            "overall_url": shields_badge(
                "MCP-SEC-SCORE",
                f"{data.get('mcp_sec_score')}%20%7C%20Grade%20{data.get('grade')}",
                GRADE_COLORS.get(str(data.get("grade", "F")), "lightgrey"),
            ),
            "adapters": adapters,
            "proof_url": args.proof_url,
        }
        (output_dir / "badges.json").write_text(json.dumps(payload, indent=2), encoding="utf-8")

    print(f"Generated badges in {output_dir}")
    print(overall)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
