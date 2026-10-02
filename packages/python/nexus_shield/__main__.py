"""Nexus Shield developer CLI — reference stack, policy tests, optional PII proxy."""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path

from nexus_shield import __version__


def _repo_root() -> Path:
    env = os.environ.get("NEXUS_SHIELD_ROOT")
    if env:
        root = Path(env).resolve()
        if (root / "docker-compose.nexus-reference.yml").is_file():
            return root
        raise SystemExit(f"NEXUS_SHIELD_ROOT invalid (missing docker-compose.nexus-reference.yml): {root}")
    for candidate in [Path.cwd(), *Path.cwd().parents]:
        if (candidate / "docker-compose.nexus-reference.yml").is_file():
            return candidate
    raise SystemExit(
        "Not inside a core-ai-firewall checkout. Clone the repo or set NEXUS_SHIELD_ROOT."
    )


def _run(cmd: list[str], *, cwd: Path) -> int:
    print("+", " ".join(cmd), file=sys.stderr)
    return subprocess.call(cmd, cwd=cwd)


def _cmd_reference(args: argparse.Namespace) -> int:
    root = _repo_root()
    compose = ["docker", "compose", "-f", "docker-compose.nexus-reference.yml"]
    if args.action == "up":
        cmd = [*compose, "up"]
        if args.detach:
            cmd.append("-d")
        if args.build:
            cmd.append("--build")
        return _run(cmd, cwd=root)
    if args.action == "down":
        cmd = [*compose, "down", "--remove-orphans"]
        return _run(cmd, cwd=root)
    return 1


def _cmd_policy_test(args: argparse.Namespace) -> int:
    root = _repo_root()
    if not shutil.which("pytest"):
        raise SystemExit("pytest not found — pip install nexus-shield[dev] or pip install pytest")
    cmd = [
        sys.executable,
        "-m",
        "pytest",
        "tests/test_policy_engine.py",
        "tests/test_governance_framework.py",
        "-v",
        "--tb=short",
    ]
    if args.extra:
        cmd.extend(args.extra)
    return _run(cmd, cwd=root)


def _cmd_proxy(args: argparse.Namespace) -> int:
    try:
        from nexus_shield_cli.proxy import run_proxy  # type: ignore
        from nexus_shield_cli.sanitize import MaskOptions  # type: ignore
    except ImportError as exc:
        raise SystemExit(
            "PII proxy requires the CLI extras: pip install -e '.[proxy]' "
            "and pip install -e packages/cli (monorepo), or pip install nexus-shield-cli."
        ) from exc
    mask = MaskOptions.all_enabled() if args.mask_all else MaskOptions()
    run_proxy(
        host=args.host,
        port=args.port,
        upstream_base=args.target.rstrip("/"),
        mask_options=mask,
    )
    return 0


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="nexus-shield",
        description="Nexus Shield — reference stack, policy tests, and Security Engine proxy.",
    )
    parser.add_argument("--version", action="version", version=f"nexus-shield {__version__}")
    sub = parser.add_subparsers(dest="command", required=True)

    ref = sub.add_parser("reference", help="Run Phase 1–4 reference stack (Docker Compose)")
    ref_sub = ref.add_subparsers(dest="action", required=True)
    up = ref_sub.add_parser("up", help="docker compose up for nexus-reference")
    up.add_argument("-d", "--detach", action="store_true", help="Run in background")
    up.add_argument("--build", action="store_true", help="Build images before start")
    ref_sub.add_parser("down", help="Stop reference stack and remove orphans")

    pol = sub.add_parser("policy", help="Run governance / policy unit tests")
    pol_sub = pol.add_subparsers(dest="action", required=True)
    pt = pol_sub.add_parser("test", help="pytest policy + governance tests")
    pt.add_argument("extra", nargs=argparse.REMAINDER, help="Extra args passed to pytest")

    proxy = sub.add_parser("proxy", help="Local OpenAI-compatible PII guardrail proxy (optional)")
    proxy.add_argument("-p", "--port", type=int, default=8080)
    proxy.add_argument("-t", "--target", default="http://127.0.0.1:11434/v1")
    proxy.add_argument("--host", default="127.0.0.1")
    proxy.add_argument("--mask-all", action="store_true")

    return parser


def main(argv: list[str] | None = None) -> int:
    args = _build_parser().parse_args(argv)
    if args.command == "reference":
        return _cmd_reference(args)
    if args.command == "policy" and args.action == "test":
        return _cmd_policy_test(args)
    if args.command == "proxy":
        return _cmd_proxy(args)
    return 1


if __name__ == "__main__":
    sys.exit(main())
