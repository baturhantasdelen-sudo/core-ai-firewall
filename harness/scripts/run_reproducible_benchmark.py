#!/usr/bin/env python3
"""
Reproducible MCP-SEC-SCORE benchmark runner.

Usage:
    python scripts/run_reproducible_benchmark.py
    python scripts/run_reproducible_benchmark.py --eval-mcp --output results/mcp_leaderboard.json
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
        help="Run MCP hijack scenario evaluation (default when no other flags)",
    )
    parser.add_argument(
        "--output",
        default="results/mcp_leaderboard.json",
        help="JSON output path for leaderboard results",
    )
    args = parser.parse_args()

    if not args.eval_mcp and len(sys.argv) == 1:
        args.eval_mcp = True

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
