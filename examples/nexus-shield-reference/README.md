# Nexus Shield Phase 1 — Accountability reference

End-to-end demo of **Agent Passport** validation, **outcome verification**, and **UAR 2.0** sealing.

## Stack

| Service | Port | Role |
|---------|------|------|
| `mock-api` | 8300 (internal) | Mock ERP state (`/state`, `/tools/*`) |
| `accountability-sidecar` | 8092 | Passport + policy + UAR 2.0 |
| `agent-simulator` | — | Valid / invalid action scenarios |

## Quick start

From repository root:

```bash
docker compose -f examples/nexus-shield-reference/docker-compose.yml up --build
```

Verify a UAR 2.0 receipt locally (after saving JSON from sidecar response):

```bash
pip install -e .
nexus-shield uar verify path/to/receipt.json
```

## Modules (Python package)

- `nexus_shield.passport` — `AgentPassport`, `validate_passport`
- `nexus_shield.outcome_verifier` — `verify_outcome`
- `nexus_shield.uar_verify` — UAR 2.0 `build_uar_v2_receipt`, `verify_receipt_dict`

Architecture: [docs/ARCHITECTURE_MAPPING.md](../../docs/ARCHITECTURE_MAPPING.md)
