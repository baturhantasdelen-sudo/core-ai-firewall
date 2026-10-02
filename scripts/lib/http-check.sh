#!/usr/bin/env bash
# Shared HTTP helpers — avoid curl exit 23 (SIGPIPE) when grep -q closes the pipe early.

curl_body_must_contain() {
  local url="$1"
  local needle="$2"
  local body
  body="$(curl -fsS "${url}")" || return 1
  grep -qF "${needle}" <<< "${body}"
}

curl_body_must_match_ere() {
  local url="$1"
  local pattern="$2"
  local body
  body="$(curl -fsS "${url}")" || return 1
  grep -qE "${pattern}" <<< "${body}"
}

body_must_contain() {
  local body="$1"
  local needle="$2"
  grep -qF "${needle}" <<< "${body}"
}

body_must_match_ere() {
  local body="$1"
  local pattern="$2"
  grep -qE "${pattern}" <<< "${body}"
}
