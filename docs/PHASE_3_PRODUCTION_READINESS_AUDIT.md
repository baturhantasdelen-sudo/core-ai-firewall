# Phase 3 — Production Readiness Audit

**Verified:** 2026-10-09  
**Base commit:** `979d09abd5` (Assurance Engine)  
**Branch:** `main`

## Working tree (protected)

Pre-existing **uncommitted website/marketing** changes remain separate (nav, homepage, platform routes, etc.). Phase 3 commits exclude those files.

## Persistence (before → after)

| Before | After |
|--------|--------|
| In-memory `Map` in `outcome/store.ts` | `assurance-persistence/` abstraction |
| Process-local idempotency | SQLite file + Supabase schema (`schema-assurance.sql`) |
| No tenant scope on reads | `org_id` from API key on all durable reads/writes |

**Default dev backend:** SQLite at `.data/nexus-assurance.sqlite` (Node `node:sqlite`).  
**Production:** Set `NEXUS_ASSURANCE_SQLITE_PATH` or apply `schema-assurance.sql` to Supabase and enable service-role writes (future `NEXUS_ASSURANCE_USE_SUPABASE`).

## Tenant model

Organizations table (`organizations.id`) via `authenticateApiKey()` — same as telemetry/scans.

## APIs (unchanged contracts, extended)

- `POST /api/v1/outcome/verify` — persists when org authenticated; rejects client `record_type`
- `GET /api/v1/outcome/{id}` — tenant-scoped
- `GET /api/v1/proof/verification/{id}` — full proof payload + server provenance

## Proof Center

- `VerificationProofLookup` on `/proof-center` and `/proof-center/verification/[id]`
- API key required for REAL persisted records; errors do not show fake proof

## Finance/ERP

- Adapter `finance_erp_http` + env-gated live reads
- Live validation: **BLOCKED BY CONFIGURATION** unless `NEXUS_FINANCE_ERP_*` set

## Implementation sequence executed

1. Persistence abstraction + SQLite + migrations  
2. Engine/store tenant scope + idempotency  
3. Proof API + UI  
4. Finance ERP observer scaffold  
5. Tests (44 nexus-core, persistence restart, IDOR)  
6. Documentation  

## External configuration required

- `NEXUS_ASSURANCE_SQLITE_PATH` (production)  
- `NEXUS_HTTP_VERIFY_ALLOWLIST` + `NEXUS_FINANCE_ERP_BASE_URL` for live HTTP observer  
- Supabase: run `schema-assurance.sql` for hosted Postgres parity  
