#!/usr/bin/env bash
# Retry HTTP until URL matches grep pattern (used after compose up / nginx restart).
set -euo pipefail

URL="${1:?url}"
PATTERN="${2:-HEALTHY}"
MAX_ATTEMPTS="${3:-45}"
SLEEP_SEC="${4:-2}"

_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/lib/http-check.sh
source "${_SCRIPT_DIR}/lib/http-check.sh"

for ((i = 1; i <= MAX_ATTEMPTS; i++)); do
  if curl_body_must_contain "${URL}" "${PATTERN}"; then
    echo "wait-for-http: OK ${URL} (attempt ${i})"
    exit 0
  fi
  sleep "${SLEEP_SEC}"
done

echo "wait-for-http: TIMEOUT ${URL} after ${MAX_ATTEMPTS} attempts" >&2
curl -v "${URL}" 2>&1 | tail -20 >&2 || true
exit 1
