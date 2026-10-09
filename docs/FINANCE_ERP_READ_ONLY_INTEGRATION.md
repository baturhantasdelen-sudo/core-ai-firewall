# Finance / ERP Read-Only Integration

## Adapter

`finance_erp_http` — `FinanceErpHttpOutcomeAdapter` in `outcome-adapter-v2.ts`.

## Read-only guarantees

GET/HEAD observation only. No refunds, payments, or writes.

## Configuration

| Variable | Purpose |
|----------|---------|
| `NEXUS_FINANCE_ERP_BASE_URL` | HTTPS sandbox base (allowlisted host) |
| `NEXUS_FINANCE_ERP_ENV` | Must not be `production` for observer |
| `NEXUS_HTTP_VERIFY_ALLOWLIST` | Host allowlist for HTTP reads |
| `NEXUS_FINANCE_ERP_INLINE_FIXTURE` | JSON for contract tests without live network |
| `NEXUS_FINANCE_ERP_LIVE_TEST=true` | Enables live test gate (all vars required) |

## Authoritative source

Invoice state from configured ERP/sandbox HTTP API (`source: finance_erp`, `environment` in observed state).

Payment provider vs ERP policy: use existing multi-source assurance rules where both are configured.

## Live validation status

**BLOCKED BY CONFIGURATION** in default CI/dev — no sandbox credentials in repo.

Deterministic mock scenarios (A–F) continue via `mock` adapter fixtures.
