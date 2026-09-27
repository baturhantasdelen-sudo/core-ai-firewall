#!/usr/bin/env python3
"""
Detect & Demonstrate — independent cryptographic verification demo.

Runs the default FinTech preset from presets/ and prints the public /verify URL.

Usage:
    python scripts/simulate_independent_demo.py
    python scripts/simulate_independent_demo.py --write-public-json
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from preset_verification import (  # noqa: E402
    LEGACY_PROOF_JSON,
    build_proof_from_preset,
    load_manifest,
    load_preset_definition,
    print_cli_report,
    write_public_artifacts,
)


def main() -> int:
    parser = argparse.ArgumentParser(description="FinTech independent verification demo simulator")
    parser.add_argument(
        "--write-public-json",
        action="store_true",
        help="Write dashboard demo JSON (default preset + full CVE preset index)",
    )
    parser.add_argument("--output", type=Path, default=None, help="Optional JSON output path")
    args = parser.parse_args()

    manifest = load_manifest()
    default_id = manifest["default_preset_id"]
    preset = load_preset_definition(default_id)
    payload = build_proof_from_preset(preset)

    print("\n=== Nexus Shield - Detect & Demonstrate (Independent Verification) ===\n")
    print_cli_report(payload, banner=False)

    if args.write_public_json:
        proofs = {}
        for entry in manifest["presets"]:
            pid = entry["preset_id"]
            proofs[pid] = build_proof_from_preset(load_preset_definition(pid))
        write_public_artifacts(proofs)
        print("Wrote CVE preset index and proof bundles under nexus-shield-dashboard/public/demo/")

    out = args.output
    if out:
        out = out.resolve()
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(f"Wrote: {out}")
    elif args.write_public_json:
        print(f"Legacy default proof: {LEGACY_PROOF_JSON}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
