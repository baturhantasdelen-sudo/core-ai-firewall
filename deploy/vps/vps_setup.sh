#!/usr/bin/env bash
# vps_setup.sh — Google Cloud (GCE) Ubuntu VM ilk kurulum
#
# GCP VM'e SSH ile baglandiktan sonra:
#   sudo bash vps_setup.sh /tmp/nexus_deploy.pub
#
# Ortam degiskenleri (opsiyonel):
#   DEPLOY_USER=<ssh_kullaniciniz>   — GCE Ubuntu'da genelde VM olustururken belirlediginiz kullanici
#   DEPLOY_PATH=/opt/nexus-core-firewall
#
# GCP Console: VPC agi > Firewall — tcp:22 (SSH) ve tcp:80 (HTTP) inbound acik olmali.

set -euo pipefail

DEPLOY_PATH="${DEPLOY_PATH:-/opt/nexus-core-firewall}"
DEPLOY_USER="${DEPLOY_USER:-ubuntu}"
SSH_PUB_KEY_FILE="${1:-}"

log() { echo "[vps_setup] $*"; }

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Lutfen sudo ile calistirin: sudo bash vps_setup.sh [deploy_public_key.pub]"
  exit 1
fi

if ! grep -qi ubuntu /etc/os-release 2>/dev/null; then
  log "Uyari: Ubuntu disi dagitim; script Ubuntu (GCE) icin yazilmistir."
fi

export DEBIAN_FRONTEND=noninteractive

log "[1/6] Paket guncellemesi..."
apt-get update -qq
apt-get install -y -qq ca-certificates curl gnupg ufw openssh-server git

log "[2/6] Docker + Docker Compose plugin..."
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
  log "Uyari: '$DEPLOY_USER' yok. GCE kullaniciniz farkliysa: DEPLOY_USER=adınız sudo bash vps_setup.sh"
fi

log "[3/6] Proje deploy dizin yapisi..."
mkdir -p "$DEPLOY_PATH"
mkdir -p "${DEPLOY_PATH}/deploy/grafana/provisioning/dashboards"
mkdir -p "${DEPLOY_PATH}/deploy/grafana/provisioning/datasources"

if id "$DEPLOY_USER" &>/dev/null; then
  chown -R "${DEPLOY_USER}:${DEPLOY_USER}" "$DEPLOY_PATH"
fi

# Ilk deploy / scp oncesi gerekli dosyalar (GitHub Actions docker compose pull icin)
REQUIRED_FILES=(
  "docker-compose.prod.yml"
  "nginx.conf"
)
for f in "${REQUIRED_FILES[@]}"; do
  if [[ ! -f "${DEPLOY_PATH}/${f}" ]]; then
    log "Bekleniyor (ilk deploy oncesi kopyalayin): ${DEPLOY_PATH}/${f}"
  fi
done

log "[4/6] SSH guvenligi..."
DEPLOY_HOME="$(getent passwd "$DEPLOY_USER" 2>/dev/null | cut -d: -f6 || echo "/root")"
AUTH_KEYS="${DEPLOY_HOME}/.ssh/authorized_keys"

if id "$DEPLOY_USER" &>/dev/null; then
  mkdir -p "${DEPLOY_HOME}/.ssh"
  chmod 700 "${DEPLOY_HOME}/.ssh"
  touch "$AUTH_KEYS"
  chmod 600 "$AUTH_KEYS"
  chown -R "${DEPLOY_USER}:${DEPLOY_USER}" "${DEPLOY_HOME}/.ssh"
fi

if [[ -n "$SSH_PUB_KEY_FILE" && -f "$SSH_PUB_KEY_FILE" ]]; then
  PUB_LINE="$(tr -d '\r\n' < "$SSH_PUB_KEY_FILE")"
  if ! grep -Fq "$PUB_LINE" "$AUTH_KEYS" 2>/dev/null; then
    echo "$PUB_LINE" >> "$AUTH_KEYS"
    log "GitHub Actions deploy key eklendi."
  else
    log "Deploy key zaten authorized_keys icinde."
  fi
else
  log "Public key verilmedi — GitHub Actions icin nexus_deploy.pub ekleyin."
fi

SSHD_CFG="/etc/ssh/sshd_config"
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' "$SSHD_CFG"
sed -i 's/^#\?PubkeyAuthentication.*/PubkeyAuthentication yes/' "$SSHD_CFG"
sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin prohibit-password/' "$SSHD_CFG"
sed -i 's/^#\?ChallengeResponseAuthentication.*/ChallengeResponseAuthentication no/' "$SSHD_CFG"
sed -i 's/^#\?KbdInteractiveAuthentication.*/KbdInteractiveAuthentication no/' "$SSHD_CFG"
systemctl restart ssh

log "[5/6] UFW (sunucu firewall)..."
ufw --force reset >/dev/null 2>&1 || true
ufw default deny incoming >/dev/null
ufw default allow outgoing >/dev/null
ufw allow 22/tcp comment 'SSH' >/dev/null
ufw allow 80/tcp comment 'Nexus nginx-gateway' >/dev/null
ufw --force enable >/dev/null

log "[6/6] Dogrulama..."
docker --version
docker compose version
systemctl is-active docker
systemctl is-active ssh

cat <<EOF

=== GCE Ubuntu VM kurulumu tamamlandi ===

Deploy path : $DEPLOY_PATH
SSH user    : $DEPLOY_USER

GCP Firewall (Console > VPC network > Firewall):
  - Allow tcp:22  (SSH)
  - Allow tcp:80  (Nexus gateway)

GitHub Secrets:
  PROD_SERVER_IP       = <GCE dis (external) IPv4>
  PROD_SERVER_USER     = $DEPLOY_USER
  PROD_SSH_PRIVATE_KEY = nexus_deploy private key

Ilk deploy oncesi (yerel makineden):
  scp docker-compose.prod.yml nginx.conf \\
      ${DEPLOY_USER}@<GCE_IP>:${DEPLOY_PATH}/

Windows dogrulama:
  .\\verify_production_server.ps1 -ServerIp <GCE_IP> -SshUser $DEPLOY_USER

EOF
