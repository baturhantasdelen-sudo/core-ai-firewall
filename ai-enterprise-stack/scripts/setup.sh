#!/usr/bin/env bash
# AI Enterprise Stack — Linux / macOS Enterprise Installer
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

SKIP_HEALTH_CHECK=false
NON_INTERACTIVE=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-health-check) SKIP_HEALTH_CHECK=true; shift ;;
    --non-interactive)   NON_INTERACTIVE=true; shift ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

info()  { echo -e "${CYAN}[INFO]${NC} $*"; }
ok()    { echo -e "${GREEN}[SUCCESS]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; }

step() {
  echo ""
  echo -e "${CYAN}==> $*${NC}"
}

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

read_config_value() {
  local prompt="$1"
  local default="$2"
  if [[ "$NON_INTERACTIVE" == true ]]; then
    echo "$default"
    return
  fi
  read -r -p "$prompt [$default]: " input
  if [[ -z "${input// /}" ]]; then
    echo "$default"
  else
    echo "$input"
  fi
}

set_env_file_value() {
  local file="$1"
  local key="$2"
  local value="$3"
  if grep -qE "^[[:space:]]*${key}=" "$file" 2>/dev/null; then
    if [[ "$(uname -s)" == "Darwin" ]]; then
      sed -i '' "s|^[[:space:]]*${key}=.*|${key}=${value}|" "$file"
    else
      sed -i "s|^[[:space:]]*${key}=.*|${key}=${value}|" "$file"
    fi
  else
    echo "${key}=${value}" >>"$file"
  fi
}

wait_health_check() {
  local url="$1"
  local timeout="${2:-30}"
  local elapsed=0
  while [[ "$elapsed" -lt "$timeout" ]]; do
    if curl -sf "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
    elapsed=$((elapsed + 2))
  done
  return 1
}

show_success_banner() {
  cat <<'EOF'

  ====================================================================
       AI ENTERPRISE STACK — DEPLOYMENT SUCCESSFUL
  ====================================================================

   API Gateway (NexusShield + ResoNet)
     Health  : http://localhost:8080/healthz
     Swagger : http://localhost:8080/docs
     Nexus   : http://localhost:8080/nexus/v1/chat/completions
     ResoNet : http://localhost:8080/resonet/v1/chat/completions

   Command Center (Docker single-port proxy)
     Dashboard: http://localhost:8080/dashboard/

   Native dual-port dev (optional, separate terminal):
     Dashboard: http://localhost:8501
     Script   : ./scripts/run_dashboard.sh

   Operations:
     Logs   : docker compose logs -f ai-gateway
     Stop   : docker compose down
     Status : docker compose ps

  ====================================================================
EOF
}

echo ""
info "AI Enterprise Stack — Enterprise Installer (Linux/macOS)"
info "Project: $PROJECT_ROOT"

# --- 1. Prerequisites ---
step "Checking prerequisites"

if ! command_exists docker; then
  error "Docker is not installed. See https://docs.docker.com/engine/install/"
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  error "Docker daemon is not running. Start Docker and retry."
  exit 1
fi
ok "Docker daemon is running"

if docker compose version >/dev/null 2>&1; then
  ok "Docker Compose available ($(docker compose version --short 2>/dev/null || echo 'v2'))"
else
  error "Docker Compose v2 plugin not found."
  exit 1
fi

if command_exists ollama; then
  ok "Ollama CLI detected ($(ollama --version 2>/dev/null || echo 'installed'))"
  if curl -sf http://localhost:11434/api/tags >/dev/null 2>&1; then
    ok "Ollama API reachable at http://localhost:11434"
  else
    warn "Ollama not reachable on :11434 — start with: ollama serve"
  fi
else
  warn "Ollama not in PATH — ResoNet local routing requires Ollama on the host"
fi

if ! command_exists curl; then
  warn "curl not found — health check will be skipped"
  SKIP_HEALTH_CHECK=true
fi

# --- 2. Environment configuration ---
step "Configuring environment (.env)"

ENV_FILE="$PROJECT_ROOT/.env"
ENV_EXAMPLE="$PROJECT_ROOT/.env.example"

if [[ -f "$ENV_FILE" ]]; then
  ok "Existing .env found — preserving active configuration (no overwrite)"
else
  if [[ ! -f "$ENV_EXAMPLE" ]]; then
    error ".env.example not found at $ENV_EXAMPLE"
    exit 1
  fi
  cp "$ENV_EXAMPLE" "$ENV_FILE"
  ok "Created .env from .env.example"

  API_KEY="$(read_config_value "Enter OPENAI_API_KEY" "sk-your-openai-api-key")"
  GRID_REGION="$(read_config_value "Enter GRID_CARBON_REGION (global, us, eu, tr, ...)" "global")"
  COMPRESSION_THRESHOLD="$(read_config_value "Enter RESONET_COMPRESSION_TOKEN_THRESHOLD" "200")"

  set_env_file_value "$ENV_FILE" "OPENAI_API_KEY" "$API_KEY"
  set_env_file_value "$ENV_FILE" "GRID_CARBON_REGION" "$GRID_REGION"
  set_env_file_value "$ENV_FILE" "RESONET_COMPRESSION_TOKEN_THRESHOLD" "$COMPRESSION_THRESHOLD"
  set_env_file_value "$ENV_FILE" "STREAMLIT_ENABLED" "true"
  set_env_file_value "$ENV_FILE" "TELEMETRY_DB_PATH" "/app/data/telemetry.db"
  ok "Interactive .env values saved"
fi

# --- 3. Data directory ---
step "Preparing persistent data directory"

DATA_DIR="$PROJECT_ROOT/data"
mkdir -p "$DATA_DIR"
ok "./data directory ready"

if ! touch "$DATA_DIR/.write_test" 2>/dev/null; then
  error "Cannot write to ./data — check folder permissions"
  exit 1
fi
rm -f "$DATA_DIR/.write_test"
ok "Write permissions verified on ./data"

# --- 4. Docker build & deploy ---
step "Building and starting containers (docker compose up -d --build)"

docker compose up -d --build
ok "Containers started"

# --- 5. Health check ---
if [[ "$SKIP_HEALTH_CHECK" != true ]]; then
  step "Waiting for API health check (http://localhost:8080/healthz)"
  if wait_health_check "http://localhost:8080/healthz" 30; then
    ok "Health check passed (HTTP 200)"
  else
    warn "Health check timed out after 30s — service may still be starting"
    warn "Inspect logs: docker compose logs -f ai-gateway"
  fi
fi

show_success_banner
