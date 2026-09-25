#!/usr/bin/env python3
"""
Reproducible MCP-SEC-SCORE benchmark runner.

Usage:
    python scripts/run_reproducible_benchmark.py
    python scripts/run_reproducible_benchmark.py --eval-mcp --output results/mcp_leaderboard.json
    python scripts/run_reproducible_benchmark.py --eval-scorecard
    python scripts/run_reproducible_benchmark.py --export-compliance
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def run_mcp_eval(output: Path) -> int:
    output.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        sys.executable,
        "-m",
        "runners.mcp_runner",
        "--scenarios",
        "scenarios/mcp_hijack/",
        "--output",
        str(output),
    ]
    print(f"Running: {' '.join(cmd)}")
    return subprocess.call(cmd, cwd=ROOT)


def main() -> int:
    parser = argparse.ArgumentParser(description="Reproducible MCP-SEC-SCORE benchmark")
    parser.add_argument(
        "--eval-mcp",
        action="store_true",
        help="Run MCP hijack scenario evaluation",
    )
    parser.add_argument(
        "--eval-scorecard",
        action="store_true",
        help="Run 2026 Shadow AI Agent & indirect injection scorecard",
    )
    parser.add_argument(
        "--export-compliance",
        action="store_true",
        help="Export SOC 2 / ISO oriented compliance evidence bundle (JSON + CSV)",
    )
    parser.add_argument(
        "--output",
        default="results/mcp_leaderboard.json",
        help="JSON output path for leaderboard results",
    )
    args = parser.parse_args()

    if not args.eval_mcp and not args.eval_scorecard and len(sys.argv) == 1:
        args.eval_mcp = True

    if args.eval_scorecard:
        cmd = [sys.executable, str(ROOT / "scripts" / "eval_scorecard.py"), "--output", "results/scorecard_2026.json"]
        print(f"Running: {' '.join(cmd)}")
        return subprocess.call(cmd, cwd=ROOT)

    if args.export_compliance:
        cmd = [
            sys.executable,
            "-m",
            "runners.compliance_exporter",
            "--leaderboard",
            str(ROOT / args.output),
            "--output-dir",
            str(ROOT / "results" / "compliance"),
        ]
        print(f"Running: {' '.join(cmd)}")
        return subprocess.call(cmd, cwd=ROOT)

    if args.eval_mcp:
        rc = run_mcp_eval(ROOT / args.output)
        if rc != 0:
            return rc
        data = json.loads((ROOT / args.output).read_text(encoding="utf-8"))
        print(json.dumps({"status": "ok", "output": args.output, "entries": len(data.get("entries", []))}, indent=2))
        return 0

    parser.print_help()
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
