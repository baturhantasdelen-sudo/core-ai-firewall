# Assurance Persistence

## Interface

`lib/nexus-core/assurance-persistence/` — `AssurancePersistence` with:

- `saveBundle(scope, verification, uarPayload)` — atomic SQLite transaction (BEGIN/COMMIT)
- `getVerification(org_id, verification_id)`
- `getEvidence`, `getUar`, `findIdempotency`

## Backends

| Mode | When |
|------|------|
| SQLite | Default dev; `NEXUS_ASSURANCE_SQLITE_PATH` in production |
| Memory | Unit tests only (`initAssurancePersistence({ mode: 'memory' })`) |
| Supabase | `schema-assurance.sql` — apply manually; app wiring optional |

Production **must not** rely on in-memory maps. Unconfigured production throws via `resolveDefaultSqlitePath()`.

## Idempotency

Tenant-scoped `(org_id, idempotency_key)` with `request_fingerprint`. Conflicting payload → `IdempotencyConflictError`.

## Failure behavior

If persistence fails after VERIFIED/FAILED/BLOCKED computation, status downgrades to **UNVERIFIED** with `Persistence failed: …` (except idempotency conflicts, which propagate).

## Migrations

- Postgres: `nexus-shield-dashboard/schema-assurance.sql`
- SQLite: auto-created schema in `SqliteAssurancePersistence`

## Environment

- `NEXUS_ASSURANCE_SQLITE_PATH` — durable file path  
- `NEXUS_ASSURANCE_ALLOW_MEMORY=true` — test-only escape hatch  
