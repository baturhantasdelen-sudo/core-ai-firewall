#!/usr/bin/env python3
"""Launch the TypeScript Playwright demo recorder (requires Node + dashboard deps)."""

from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DASHBOARD = ROOT / "nexus-shield-dashboard"
SCRIPT = ROOT / "scripts" / "generate_demo_recording.ts"


def main() -> int:
    if not SCRIPT.is_file():
        print(f"Missing recorder script: {SCRIPT}", file=sys.stderr)
        return 1
    if not (DASHBOARD / "node_modules" / "playwright").is_dir():
        print(
            "Playwright not installed. Run: cd nexus-shield-dashboard && npm install && npx playwright install chromium",
            file=sys.stderr,
        )
        return 1

    if not shutil.which("ffmpeg"):
        print("ffmpeg is required on PATH to render MP4 output.", file=sys.stderr)
        return 1

    npx = "npx.cmd" if sys.platform == "win32" else "npx"
    cmd = [npx, "tsx", str(SCRIPT)]
    try:
        subprocess.check_call(cmd, cwd=str(DASHBOARD))
    except subprocess.CalledProcessError as exc:
        return exc.returncode
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
