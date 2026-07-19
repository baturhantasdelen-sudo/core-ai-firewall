#!/usr/bin/env bash
# vps_setup.sh — Google Cloud (GCE) Ubuntu VM kurumsal ilk kurulum
#
# Calistirma (VM icinde, repo klonlandiktan sonra):
#   sudo DEPLOY_USER=ubuntu bash deploy/vps/vps_setup.sh /tmp/nexus_deploy.pub
#
# Ortam degiskenleri (opsiyonel):
#   DEPLOY_USER=ubuntu
#   DEPLOY_PATH=/opt/nexus-core-firewall
#
# GCP Console > VPC network > Firewall: tcp:22, tcp:80, tcp:443 inbound

set -euo pipefail

DEPLOY_PATH="${DEPLOY_PATH:-/opt/nexus-core-firewall}"
DEPLOY_USER="${DEPLOY_USER:-ubuntu}"
SSH_PUB_KEY_FILE="${1:-/tmp/nexus_deploy.pub}"

log() { echo "[vps_setup] $*"; }
die() { log "HATA: $*"; exit 1; }

if [[ "$(id -u)" -ne 0 ]]; then
  die "sudo ile calistirin: sudo DEPLOY_USER=ubuntu bash deploy/vps/vps_setup.sh /tmp/nexus_deploy.pub"
fi

if ! grep -qi ubuntu /etc/os-release 2>/dev/null; then
  log "Uyari: Ubuntu disi dagitim; script GCE Ubuntu icin yazilmistir."
fi

export DEBIAN_FRONTEND=noninteractive

log "[1/6] Paket guncellemesi..."
apt-get update -qq
apt-get install -y -qq ca-certificates curl gnupg ufw openssh-server git

log "[2/6] Docker Engine + Docker Compose plugin..."
if ! command -v docker >/dev/null 2>&1; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
    $(. /etc/os-release && echo "${VERSION_CODENAME:-jammy}") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin
fi

systemctl enable --now docker

if id "$DEPLOY_USER" &>/dev/null; then
  usermod -aG docker "$DEPLOY_USER"
  log "Kullanici '$DEPLOY_USER' docker grubuna eklendi."
else
  die "Kullanici '$DEPLOY_USER' bulunamadi. DEPLOY_USER ortam degiskenini GCE SSH kullaniciniza gore ayarlayin."
fi

log "[3/6] Deploy dizin yapisi: $DEPLOY_PATH"
mkdir -p "$DEPLOY_PATH"
mkdir -p "${DEPLOY_PATH}/deploy/grafana/provisioning/dashboards"
mkdir -p "${DEPLOY_PATH}/deploy/grafana/provisioning/datasources"

# GitHub Actions (SCP) ve docker compose icin tam okuma/yazma yetkisi
chown -R "${DEPLOY_USER}:${DEPLOY_USER}" "$DEPLOY_PATH"
find "$DEPLOY_PATH" -type d -exec chmod 775 {} \;
find "$DEPLOY_PATH" -type f -exec chmod 664 {} \; 2>/dev/null || true
chmod 775 "$DEPLOY_PATH"

log "Config dosyalari (docker-compose.prod.yml, nginx.conf) GitHub Actions ile otomatik senkronize edilir."

log "[4/6] SSH sertlestirme + deploy key..."
DEPLOY_HOME="$(getent passwd "$DEPLOY_USER" | cut -d: -f6)"
AUTH_KEYS="${DEPLOY_HOME}/.ssh/authorized_keys"

mkdir -p "${DEPLOY_HOME}/.ssh"
chmod 700 "${DEPLOY_HOME}/.ssh"
touch "$AUTH_KEYS"
chmod 600 "$AUTH_KEYS"
chown -R "${DEPLOY_USER}:${DEPLOY_USER}" "${DEPLOY_HOME}/.ssh"

if [[ -f "$SSH_PUB_KEY_FILE" ]]; then
  if ! ssh-keygen -lf "$SSH_PUB_KEY_FILE" >/dev/null 2>&1; then
    die "Gecersiz deploy public key: $SSH_PUB_KEY_FILE"
  fi
  PUB_LINE="$(tr -d '\r\n' < "$SSH_PUB_KEY_FILE")"
  if ! grep -Fxq "$PUB_LINE" "$AUTH_KEYS" 2>/dev/null; then
    echo "$PUB_LINE" >> "$AUTH_KEYS"
    log "Deploy key authorized_keys dosyasina eklendi: $SSH_PUB_KEY_FILE"
  else
    log "Deploy key zaten authorized_keys icinde."
  fi
else
  die "Deploy public key bulunamadi: $SSH_PUB_KEY_FILE (ornek: scp nexus_deploy.pub ubuntu@IP:/tmp/)"
fi

SSHD_CFG="/etc/ssh/sshd_config"
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' "$SSHD_CFG"
sed -i 's/^#\?PubkeyAuthentication.*/PubkeyAuthentication yes/' "$SSHD_CFG"
sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin prohibit-password/' "$SSHD_CFG"
sed -i 's/^#\?ChallengeResponseAuthentication.*/ChallengeResponseAuthentication no/' "$SSHD_CFG"
sed -i 's/^#\?KbdInteractiveAuthentication.*/KbdInteractiveAuthentication no/' "$SSHD_CFG"
systemctl restart ssh

log "[5/6] UFW — yalnizca 22, 80, 443..."
ufw --force reset >/dev/null 2>&1 || true
ufw default deny incoming >/dev/null
ufw default allow outgoing >/dev/null
ufw allow 22/tcp comment 'SSH' >/dev/null
ufw allow 80/tcp comment 'HTTP' >/dev/null
ufw allow 443/tcp comment 'HTTPS' >/dev/null
ufw --force enable >/dev/null

log "[6/6] Dogrulama..."
docker --version
docker compose version
systemctl is-active docker
systemctl is-active ssh
ufw status numbered | head -10

cat <<EOF

=== GCE Ubuntu VM kurulumu tamamlandi ===

Deploy path : $DEPLOY_PATH
SSH user    : $DEPLOY_USER

GCP VPC Firewall (Console):
  tcp:22  — SSH (GitHub Actions)
  tcp:80  — Nexus nginx-gateway
  tcp:443 — HTTPS (TLS sonrasi)

GitHub Secrets:
  PROD_SERVER_IP       = <GCE static external IPv4>
  PROD_SERVER_USER     = $DEPLOY_USER
  PROD_SSH_PRIVATE_KEY = nexus_deploy private key

Ilk push'tan itibaren GitHub Actions config dosyalarini bu dizine SCP ile yazar.
Manuel scp gerekmez.

Windows dogrulama:
  .\\verify_production_server.ps1 -ServerIp "<GCE_STATIC_IP>" -SshUser $DEPLOY_USER

EOF
