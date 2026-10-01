"""Resolve Nexus local data paths (repo root or GitHub Action checkout)."""

from __future__ import annotations

import os
from pathlib import Path


def repo_root() -> Path:
    env = os.environ.get("NEXUS_REPO_ROOT") or os.environ.get("GITHUB_ACTION_PATH")
    if env:
        return Path(env).resolve()
    return Path(__file__).resolve().parents[1]


def data_dir() -> Path:
    override = os.environ.get("NEXUS_DATA_DIR")
    if override:
        path = Path(override).resolve()
    else:
        path = repo_root() / "nexus" / "data"
    path.mkdir(parents=True, exist_ok=True)
    return path


def default_policy_path() -> Path:
    override = os.environ.get("NEXUS_POLICY_PATH")
    if override:
        return Path(override).resolve()
    shipped = repo_root() / "nexus" / "policy.yml"
    effective = data_dir() / "policy.effective.yml"
    if effective.is_file():
        return effective
    return shipped


def policy_snapshots_dir() -> Path:
    path = data_dir() / "policy_snapshots"
    path.mkdir(parents=True, exist_ok=True)
    return path
