"""GitHub Actions repository secrets — güvenli yükleme (GitHub Public Key + NaCl seal)."""

from __future__ import annotations

import argparse
import base64
import os
import sys

import requests
from nacl import encoding, public

REPO_OWNER = os.getenv("REPO_OWNER", "baturhantasdelen-sudo")
REPO_NAME = "core-ai-firewall"

REQUIRED_SECRETS = [
    "DOCKER_USERNAME",
    "DOCKER_PASSWORD",
    "PROD_SERVER_IP",
    "PROD_SERVER_USER",
    "PROD_SSH_PRIVATE_KEY",
    "CLOUDFLARE_TUNNEL_TOKEN",
    "POSTHOG_API_KEY",
    "CLOUDFLARE_WEB_ANALYTICS_TOKEN",
    "PROD_PUBLIC_URL",
    "API_KEY_SECRET",
]


def _headers(token: str) -> dict[str, str]:
    return {
        "Authorization": f"token {token}",
        "Accept": "application/vnd.github+json",
    }


def get_public_key(token: str) -> tuple[str, str]:
    url = f"https://api.github.com/repos/{REPO_OWNER}/{REPO_NAME}/actions/secrets/public-key"
    response = requests.get(url, headers=_headers(token), timeout=30)
    if response.status_code != 200:
        print(f"❌ Public key alınamadı: {response.status_code} — {response.text}")
        sys.exit(1)
    data = response.json()
    return data["key_id"], data["key"]


def encrypt_secret(public_key_b64: str, secret_value: str) -> str:
    pk = public.PublicKey(public_key_b64.encode("utf-8"), encoding.Base64Encoder())
    sealed_box = public.SealedBox(pk)
    encrypted = sealed_box.encrypt(secret_value.encode("utf-8"))
    return base64.b64encode(encrypted).decode("utf-8")


def set_secret(token: str, name: str, value: str) -> None:
    if not value.strip():
        print(f"⚠️  {name} boş — atlandı.")
        return

    key_id, public_key = get_public_key(token)
    encrypted_value = encrypt_secret(public_key, value)
    url = f"https://api.github.com/repos/{REPO_OWNER}/{REPO_NAME}/actions/secrets/{name}"
    response = requests.put(
        url,
        headers=_headers(token),
        json={"encrypted_value": encrypted_value, "key_id": key_id},
        timeout=30,
    )
    if response.status_code in (201, 204):
        print(f"✅ {name} GitHub'a yüklendi.")
        return

    print(f"❌ {name} yüklenemedi: {response.status_code} — {response.text}")
    sys.exit(1)


def list_secrets(token: str) -> list[str]:
    url = f"https://api.github.com/repos/{REPO_OWNER}/{REPO_NAME}/actions/secrets"
    response = requests.get(url, headers=_headers(token), timeout=30)
    if response.status_code != 200:
        print(f"❌ Secret listesi alınamadı: {response.status_code} — {response.text}")
        sys.exit(1)
    return [item["name"] for item in response.json().get("secrets", [])]


def main() -> int:
    parser = argparse.ArgumentParser(description="GitHub Actions secret yükleyici")
    parser.add_argument("--name", help="Yüklenecek secret adı")
    parser.add_argument(
        "--value-env",
        default="SECRET_VALUE",
        help="Secret değerinin okunacağı ortam değişkeni (varsayılan: SECRET_VALUE)",
    )
    args = parser.parse_args()

    token = os.getenv("GITHUB_TOKEN")
    if not token:
        print("❌ GITHUB_TOKEN ortam değişkeni gerekli.")
        return 1

    if not args.name:
        print("❌ --name parametresi gerekli.")
        return 1

    if args.name not in REQUIRED_SECRETS:
        print(f"⚠️  {args.name} beklenen secret listesinde yok; yine de yükleniyor.")

    value = os.getenv(args.value_env, "")
    if args.name == "PROD_SSH_PRIVATE_KEY" and value:
        value = value.replace("\r\n", "\n").replace("\r", "\n").strip() + "\n"
    set_secret(token, args.name, value)
    return 0


if __name__ == "__main__":
    sys.exit(main())
