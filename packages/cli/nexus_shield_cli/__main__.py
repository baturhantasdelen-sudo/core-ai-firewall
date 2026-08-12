from __future__ import annotations

import argparse
import logging
import sys

from nexus_shield_cli import __version__
from nexus_shield_cli.proxy import run_proxy
from nexus_shield_cli.sanitize import MaskOptions


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="nexus-shield",
        description="Nexus Shield CLI — local OpenAI-compatible PII guardrail proxy.",
    )
    parser.add_argument("--version", action="version", version=f"nexus-shield {__version__}")

    subparsers = parser.add_subparsers(dest="command", required=True)

    proxy_parser = subparsers.add_parser(
        "proxy",
        help="Run a local OpenAI-compatible proxy with in-RAM PII redaction.",
    )
    proxy_parser.add_argument(
        "-p",
        "--port",
        type=int,
        default=8080,
        help="Local proxy port (default: 8080)",
    )
    proxy_parser.add_argument(
        "-t",
        "--target",
        default="http://127.0.0.1:11434/v1",
        help="Upstream LLM base URL (default: http://127.0.0.1:11434/v1 for Ollama)",
    )
    proxy_parser.add_argument(
        "--host",
        default="127.0.0.1",
        help="Bind address (default: 127.0.0.1)",
    )
    proxy_parser.add_argument(
        "--mask-all",
        action="store_true",
        help="Redact TCKN, credit cards, emails, phone numbers, and API keys",
    )

    return parser


def main(argv: list[str] | None = None) -> int:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
    args = _build_parser().parse_args(argv)

    if args.command == "proxy":
        mask_options = MaskOptions.all_enabled() if args.mask_all else MaskOptions()
        run_proxy(
            host=args.host,
            port=args.port,
            upstream_base=args.target.rstrip("/"),
            mask_options=mask_options,
        )
        return 0

    return 1


if __name__ == "__main__":
    sys.exit(main())
