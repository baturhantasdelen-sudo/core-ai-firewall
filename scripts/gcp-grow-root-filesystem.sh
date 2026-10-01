#!/usr/bin/env bash
# After increasing boot disk size in GCP Console, grow partition + filesystem.
# Requires: cloud-guest-utils (growpart)
set -euo pipefail

log() { echo "[grow-fs] $*"; }

if [[ "$(id -u)" -ne 0 ]] && ! sudo -n true 2>/dev/null; then
  log "Run as root or with passwordless sudo"
  exit 1
fi

SUDO="${SUDO:-sudo}"
ROOT_SRC="$($SUDO findmnt -n -o SOURCE /)"
log "Root block device: ${ROOT_SRC}"

if ! command -v growpart >/dev/null 2>&1; then
  log "Installing cloud-guest-utils (growpart)..."
  $SUDO apt-get update -qq
  $SUDO apt-get install -y cloud-guest-utils
fi

# e.g. /dev/sda1 → disk /dev/sda partition 1
if [[ "${ROOT_SRC}" =~ ^(/dev/[a-z]+)([0-9]+)$ ]]; then
  DISK="${BASH_REMATCH[1]}"
  PART="${BASH_REMATCH[2]}"
  log "Growing partition ${DISK} ${PART}..."
  $SUDO growpart "${DISK}" "${PART}" || true
fi

log "Resizing filesystem on ${ROOT_SRC}..."
if command -v resize2fs >/dev/null 2>&1; then
  $SUDO resize2fs "${ROOT_SRC}"
elif command -v xfs_growfs >/dev/null 2>&1; then
  $SUDO xfs_growfs /
else
  log "WARN: no resize2fs/xfs_growfs found"
fi

df -h /
log "Done. If size unchanged, increase boot disk in GCP Console first, then re-run this script."
