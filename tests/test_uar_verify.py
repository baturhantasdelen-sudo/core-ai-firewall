"""CLI and library tests for nexus-shield uar verify."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest

from nexus_shield.uar_verify import verify_receipt_dict, verify_receipt_file

ROOT = Path(__file__).resolve().parents[1]
SAMPLE = ROOT / "examples" / "sample-receipt.json"


def test_sample_receipt_file_verifies() -> None:
    result = verify_receipt_file(SAMPLE)
    assert result["valid"] is True
    assert result["format"] == "enterprise_uar"
    assert result["receipt_id"] == "uar_sample_zero_rewrite_001"


def test_tampered_receipt_fails() -> None:
    receipt = json.loads(SAMPLE.read_text(encoding="utf-8"))
    receipt["decision"] = "BLOCK"
    result = verify_receipt_dict(receipt)
    assert result["valid"] is False


def test_cli_uar_verify_success() -> None:
    proc = subprocess.run(
        [sys.executable, "-m", "nexus_shield", "uar", "verify", str(SAMPLE)],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    assert proc.returncode == 0, proc.stderr
    assert "[VERIFIED]" in proc.stdout


def test_cli_uar_verify_missing_file() -> None:
    proc = subprocess.run(
        [sys.executable, "-m", "nexus_shield", "uar", "verify", "missing-receipt.json"],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    assert proc.returncode == 1
    assert "[INVALID]" in proc.stderr
