#!/usr/bin/env bash
# diagnose-and-fix-openapi-nginx.sh — OpenAPI/Swagger routing root-cause + safe fix
#
# Production uses Docker nginx-gateway (nginx.conf on :80), NOT host sites-available.
# Do NOT symlink nexus-shield to sites-enabled/default if Docker already binds :80.
#
# Usage (on GCP VM):
#   sudo bash /opt/nexus-core-firewall/scripts/diagnose-and-fix-openapi-nginx.sh
#   sudo bash /opt/nexus-core-firewall/scripts/diagnose-and-fix-openapi-nginx.sh --apply

set -euo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-/opt/nexus-core-firewall}"
APPLY=false
if [[ "${1:-}" == "--apply" ]]; then
  APPLY=true
fi

echo "=== 1. Dinleyen Servisler ve Portlar ==="
if command -v ss >/dev/null 2>&1; then
  sudo ss -tlpn | grep -E ':80|:8080|:8000' || true
else
  sudo netstat -tlpn 2>/dev/null | grep -E ':80|:8080|:8000' || true
fi

echo
echo "=== 2. Port 80 sahibi (Docker vs host nginx) ==="
if docker ps --format '{{.Names}}' 2>/dev/null | grep -qE '^(nginx-gateway-prod|nginx_gateway_container)$'; then
  NGINX_CONTAINER=$(docker ps --format '{{.Names}}' | grep -E '^(nginx-gateway-prod|nginx_gateway_container)$' | head -1)
  echo "OK: Docker nginx gateway çalışıyor (${NGINX_CONTAINER}) — düzeltme hedefi: ${DEPLOY_DIR}/nginx.conf"
  FIX_TARGET="docker"
else
  echo "WARN: Docker nginx gateway yok — host nginx sites-enabled kontrol edilecek"
  FIX_TARGET="host"
fi

if [[ -d /etc/nginx/sites-enabled ]]; then
  echo
  echo "=== 3. Host Nginx sites-enabled ==="
  ls -la /etc/nginx/sites-enabled/ 2>/dev/null || true
  echo
  grep -rn "location" /etc/nginx/sites-enabled/ /etc/nginx/conf.d/ 2>/dev/null | head -40 || true
fi

echo
echo "=== 4. FastAPI Direct (8080) vs Gateway (80) ==="
FAST_CODE=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8080/openapi.json || echo "000")
GATE_CODE=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1/openapi.json || echo "000")
echo "FastAPI Direct (8080/openapi.json): HTTP ${FAST_CODE}"
echo "Nginx Gateway (80/openapi.json):      HTTP ${GATE_CODE}"

if [[ "${FAST_CODE}" != "200" ]]; then
  echo "ERROR: FastAPI :8080 openapi.json yanıt vermiyor. Önce nexus-shield-api konteynerini başlatın."
  exit 1
fi

if [[ "${GATE_CODE}" == "200" ]]; then
  echo "OK: Gateway zaten openapi.json döndürüyor."
  curl -I http://127.0.0.1/openapi.json 2>/dev/null | head -n 5 || true
  exit 0
fi

echo
echo "DIAGNOSIS: :8080 OK ama :80 FAIL → Nginx location çakışması veya yanlış config dosyası."

if [[ "${APPLY}" != "true" ]]; then
  echo
  echo "Düzeltmeyi uygulamak için: sudo bash $0 --apply"
  exit 2
fi

echo
echo "=== 5. Düzeltme uygulanıyor ==="

if [[ "${FIX_TARGET}" == "docker" ]]; then
  if [[ ! -f "${DEPLOY_DIR}/nginx.conf" ]]; then
    echo "ERROR: ${DEPLOY_DIR}/nginx.conf bulunamadı"
    exit 1
  fi
  if ! grep -q 'location = /openapi.json' "${DEPLOY_DIR}/nginx.conf"; then
    echo "ERROR: nginx.conf içinde 'location = /openapi.json' yok. git pull / deploy yapın."
    exit 1
  fi
  cd "${DEPLOY_DIR}"
  if docker ps --format '{{.Names}}' | grep -q '^nginx_gateway_container$'; then
    if [[ -f "${DEPLOY_DIR}/deploy/nginx/nginx-gateway-minimal.conf" ]]; then
      cp "${DEPLOY_DIR}/deploy/nginx/nginx-gateway-minimal.conf" "${DEPLOY_DIR}/nginx.conf"
    fi
    docker exec nginx_gateway_container nginx -t
    docker restart nginx_gateway_container
    echo "nginx_gateway_container yeniden başlatıldı."
  else
    docker compose -f docker-compose.prod.yml restart nginx-gateway
    echo "Docker nginx-gateway yeniden başlatıldı."
  fi
else
  if [[ ! -f "${DEPLOY_DIR}/deploy/nginx/nexus-shield.conf" ]]; then
    echo "ERROR: ${DEPLOY_DIR}/deploy/nginx/nexus-shield.conf bulunamadı"
    exit 1
  fi
  sudo cp "${DEPLOY_DIR}/deploy/nginx/nexus-shield.conf" /etc/nginx/sites-available/nexus-shield
  sudo ln -sf /etc/nginx/sites-available/nexus-shield /etc/nginx/sites-enabled/nexus-shield
  sudo rm -f /etc/nginx/sites-enabled/default
  sudo nginx -t
  sudo systemctl reload nginx
  echo "Host nginx nexus-shield config yüklendi."
fi

sleep 2
echo
echo "=== 6. Test Sonucu (200 OK bekleniyor) ==="
curl -I http://127.0.0.1/openapi.json 2>/dev/null | head -n 5 || true
FINAL=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1/openapi.json || echo "000")
if [[ "${FINAL}" == "200" ]]; then
  echo "SUCCESS: openapi.json HTTP 200"
else
  echo "FAIL: openapi.json HTTP ${FINAL}"
  exit 1
fi
