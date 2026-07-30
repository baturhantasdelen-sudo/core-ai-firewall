#!/usr/bin/env python3
"""Deploy CLOUDFLARE_TUNNEL_TOKEN to production and restart cloudflared."""

from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SSH_KEY = Path.home() / ".ssh" / "nexus_deploy"
HOST = "nexus-github-actions-deploy@35.246.212.11"


def extract_token() -> tuple[str, str] | tuple[None, None]:
    for name in (".secrets.local.json", ".secrets.local.json.example"):
        path = ROOT / name
        if not path.exists():
            continue
        text = path.read_text(encoding="utf-8")
        match = re.search(r"eyJ[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*", text)
        if match:
            return match.group(0), name
    return None, None


def main() -> int:
    token, source = extract_token()
    if not token:
        print("NO_TOKEN_FOUND in .secrets.local.json or .secrets.local.json.example")
        return 1

    print(f"Using token from {source}")

    remote = f"""set -e
cd /opt/nexus-core-firewall
grep -v '^CLOUDFLARE_TUNNEL_TOKEN=' .env > .env.tmp 2>/dev/null || true
mv .env.tmp .env 2>/dev/null || touch .env
echo 'CLOUDFLARE_TUNNEL_TOKEN={token}' >> .env
docker rm -f cloudflared-prod 2>/dev/null || true
sudo docker compose --env-file .env --profile cloudflare -f docker-compose.prod.yml up -d cloudflared
sleep 10
echo '=== LOCAL ==='
curl -s http://127.0.0.1:80/ | grep -i '<title>' || true
echo '=== LIVE ==='
curl -s https://api.nexusshield.ai/ | grep -i '<title>' || curl -s https://api.nexusshield.ai/ | head -c 250
echo
docker ps --format '{{{{.Names}}}} {{{{.Status}}}}' | grep cloudflared || true
"""

    result = subprocess.run(
        [
            "ssh.exe",
            "-i",
            str(SSH_KEY),
            "-o",
            "BatchMode=yes",
            "-o",
            "ConnectTimeout=20",
            HOST,
            remote,
        ],
        capture_output=True,
        text=True,
        timeout=120,
        check=False,
    )
    print(result.stdout)
    if result.stderr:
        print(result.stderr, file=sys.stderr)
    return result.returncode


if __name__ == "__main__":
    sys.exit(main())
