# Nexus Shield CLI

Local OpenAI-compatible proxy with sub-10ms in-RAM PII redaction. Point your app at `http://127.0.0.1:8080/v1` and keep sending requests to Ollama, OpenAI, or LiteLLM — Nexus Shield sanitizes prompts before they leave your machine.

## Point your application to the local proxy

Change your local environment variable or base URL:

```bash
# Before: pointing directly to OpenAI / Ollama
OPENAI_BASE_URL="https://api.openai.com/v1"

# After: pointing to Nexus Shield local proxy
OPENAI_BASE_URL="http://127.0.0.1:8080/v1"
```

For Ollama with the OpenAI-compatible API:

```bash
OPENAI_BASE_URL="http://127.0.0.1:8080/v1"
# Nexus Shield forwards to Ollama at http://127.0.0.1:11434/v1 by default
```

## Install

```bash
pip install nexus-shield-cli
```

Or from this repository:

```bash
pip install ./packages/cli
```

## CLI options

```bash
nexus-shield proxy [options]
```

| Option | Default | Description |
| :--- | :--- | :--- |
| `-p`, `--port` | `8080` | Local proxy port |
| `-t`, `--target` | `http://127.0.0.1:11434/v1` | Upstream LLM base URL (Ollama default) |
| `--host` | `127.0.0.1` | Bind address |
| `--mask-all` | off | Redact TCKN, credit cards, emails, phone numbers, and API keys |

### Examples

```bash
# Ollama (default upstream)
nexus-shield proxy

# OpenAI upstream
nexus-shield proxy --target https://api.openai.com/v1

# Custom port with full PII masking
nexus-shield proxy -p 9090 --mask-all
```

## How it works

1. Your SDK sends `POST /v1/chat/completions` to `http://127.0.0.1:8080/v1`.
2. Nexus Shield redacts PII in `messages`, `prompt`, and `input` fields in memory.
3. The sanitized payload is forwarded to the upstream LLM server.
4. The upstream response is streamed back unchanged.

Masked fields appear in the `X-Nexus-Shield-Masked` response header when PII is detected.

## License

MIT © Nexus Shield Team

## Docker (one-line deploy)

Build and run the PyPI-based proxy image:

```bash
docker build -t nexus-shield-proxy packages/cli
docker run --rm -p 8080:8080 nexus-shield-proxy
```

Or use the compose template (installs from PyPI on start — good for quick internal trials):

```bash
cd packages/cli
docker compose up -d
```

Point your app at the container:

```bash
OPENAI_BASE_URL="http://127.0.0.1:8080/v1"
```

### Environment variables (compose)

| Variable | Default | Description |
| :--- | :--- | :--- |
| `NEXUS_UPSTREAM_TARGET` | `https://api.openai.com/v1` | Upstream LLM base URL |
| `NEXUS_PROXY_PORT` | `8080` | Host port mapped to the proxy |

For a pre-built image workflow (Kubernetes / Swarm), use `docker-compose.prod.yml`:

```bash
cd packages/cli
docker compose -f docker-compose.prod.yml up -d --build
```
