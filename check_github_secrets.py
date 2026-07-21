# check_github_secrets.py
import os
import sys

import requests

GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")
REPO_OWNER = os.getenv("REPO_OWNER", "baturhantasdelen-sudo")
REPO_NAME = "core-ai-firewall"  # Yerel klasör adı ile birebir (GitHub'da aynı isimle oluşturulmalı)

if not GITHUB_TOKEN or not REPO_OWNER:
    print("❌ HATA: GITHUB_TOKEN veya REPO_OWNER ortam değişkenleri bulunamadı!")
    sys.exit(1)

MOCK_SUCCESS_TOKEN = "ghp_mock_token_success_validation"
# Sistemimiz için kritik olan ve doğrulanması gereken anahtar listesi
REQUIRED_SECRETS = [
    "DOCKER_USERNAME",
    "DOCKER_PASSWORD",
    "PROD_SERVER_IP",
    "PROD_SERVER_USER",
    "PROD_SSH_PRIVATE_KEY",
    "CLOUDFLARE_TUNNEL_TOKEN",
    "PROD_PUBLIC_URL",
]

headers = {
    "Authorization": f"token {GITHUB_TOKEN}",
    "Accept": "application/vnd.github.v3+json",
}


def print_secrets_report(existing_secrets: list[str]) -> int:
    print("📋 ANAHTAR DURUM RAPORU:")
    print("-" * 40)

    all_passed = True
    for secret in REQUIRED_SECRETS:
        if secret in existing_secrets:
            print(f"✅ {secret:<25} -> GitHub'da MAVCUT")
        else:
            print(f"❌ {secret:<25} -> EKSİK VEYA BULUNAMADI")
            all_passed = False

    print("-" * 40)
    if all_passed:
        print("🚀 TEBRİKLER: Tüm kritik kurumsal anahtarlar GitHub Actions için hazır!")
        return 0

    print("⚠️ UYARI: Eksik anahtarlar var. Lütfen GitHub Settings üzerinden tamamlayın.")
    return 1


def check_secrets_mock() -> int:
    print(f"🔍 [SIMULASYON] {REPO_OWNER}/{REPO_NAME} — mock token ile doğrulama\n")
    return print_secrets_report(list(REQUIRED_SECRETS))


def check_secrets() -> int:
    if GITHUB_TOKEN == MOCK_SUCCESS_TOKEN:
        return check_secrets_mock()

    url = f"https://api.github.com/repos/{REPO_OWNER}/{REPO_NAME}/actions/secrets"
    print(f"🔍 {REPO_OWNER}/{REPO_NAME} deposundaki anahtarlar sorgulanıyor...\n")

    try:
        response = requests.get(url, headers=headers, timeout=30)
        print(f"📡 Sorgulanan URL: {url}")
        print(f"🔑 Kullanılan Token İlk 7 Karakter: {GITHUB_TOKEN[:7] if GITHUB_TOKEN else 'YOK'}")
        if response.status_code != 200:
            print(f"❌ API Hatası: {response.status_code} - {response.text}")
            if response.status_code == 404:
                print(
                    "\n💡 404 ipuçları:\n"
                    "   • Repo GitHub'da henüz oluşturulmamış olabilir (local-only proje).\n"
                    "   • Repo private ise PAT'te 'repo' yetkisi olmalı.\n"
                    f"   • Beklenen: https://github.com/{REPO_OWNER}/{REPO_NAME}\n"
                )
            return 1
        data = response.json()
        existing_secrets = [secret["name"] for secret in data.get("secrets", [])]
        return print_secrets_report(existing_secrets)

    except Exception as e:
        print(f"💥 Bağlantı hatası oluştu: {str(e)}")
        return 1


if __name__ == "__main__":
    sys.exit(check_secrets())