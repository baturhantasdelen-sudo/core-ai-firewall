#!/usr/bin/env python3
"""
Enterprise pilot client — OpenAI SDK pointed at NexusShield / ResoNet proxies.

Usage:
    pip install openai
    python examples/client_python.py --module resonet
    python examples/client_python.py --module nexusshield
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

try:
    from openai import OpenAI
    from openai import APIConnectionError, APIStatusError, OpenAIError
except ImportError as exc:
    raise SystemExit("Install openai: pip install openai") from exc

GATEWAY_BASE = os.environ.get("AI_GATEWAY_BASE", "http://localhost:8080")
MODULES = {
    "nexusshield": f"{GATEWAY_BASE}/nexus/v1",
    "resonet": f"{GATEWAY_BASE}/resonet/v1",
}


def run_chat(module: str, prompt: str, model: str = "gpt-4o-mini") -> None:
    base_url = MODULES.get(module)
    if not base_url:
        raise ValueError(f"Unknown module: {module}")

    api_key = os.environ.get("OPENAI_API_KEY", "gateway-pilot-key")
    client = OpenAI(base_url=base_url, api_key=api_key)

    try:
        response = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
        )
    except APIConnectionError as exc:
        print(f"[ERROR] Gateway unreachable at {base_url}: {exc}")
        return
    except APIStatusError as exc:
        print(f"[ERROR] Gateway returned HTTP {exc.status_code}: {exc.message}")
        return
    except OpenAIError as exc:
        print(f"[ERROR] OpenAI SDK error: {exc}")
        return

    choice = response.choices[0].message.content
    print(f"Module: {module}")
    print(f"Model:  {response.model}")
    print(f"Reply:  {choice}")
    print(f"Usage:  {response.usage}")


def main() -> None:
    parser = argparse.ArgumentParser(description="AI Enterprise Stack pilot client")
    parser.add_argument(
        "--module",
        choices=list(MODULES),
        default="resonet",
        help="Proxy module to target",
    )
    parser.add_argument(
        "--prompt",
        default="What is 2 + 2? Reply in one short sentence.",
        help="User prompt",
    )
    parser.add_argument("--model", default="auto", help="Model name (auto for ResoNet routing)")
    args = parser.parse_args()
    run_chat(args.module, args.prompt, args.model)


if __name__ == "__main__":
    main()
