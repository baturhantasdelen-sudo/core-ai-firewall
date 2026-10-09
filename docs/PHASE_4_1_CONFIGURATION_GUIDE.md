# Phase 4.1 — Configuration Guide

## 1. Migrations (isolated Supabase project)

Run in SQL Editor, in order:

1. `schema.sql` (organizations)
2. `schema-assurance.sql`
3. `schema-assurance-atomic.sql`

**Rollback:** Drop function `assurance_save_bundle`; drop assurance tables in reverse FK order (test project only). Do not drop production organizations without backup.

## 2. Environment (server only)

```env
NEXUS_ASSURANCE_USE_SUPABASE=true
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=*** (never commit)
```

Optional live integration test:

```env
NEXUS_ASSURANCE_LIVE_INTEGRATION=true
```

## 3. Production fail-closed

- `NEXUS_ASSURANCE_USE_SUPABASE=true` without URL/key → startup persist throws `PersistenceUnavailableError`
- Production without Supabase or `NEXUS_ASSURANCE_SQLITE_PATH` → blocked

## 4. Dev fallback

Without `NEXUS_ASSURANCE_USE_SUPABASE`, SQLite file under `.data/nexus-assurance.sqlite` (gitignored).

## 5. Manual live smoke (owner)

1. Create two test orgs with API keys in Supabase.
2. `POST /api/v1/outcome/verify` with org A key + mock fixture.
3. `GET /api/v1/proof/verification/{id}` with same key.
4. Repeat GET with org B key → expect 404.
5. Restart app; repeat GET org A → record still present.

## 6. Verify RPC grants

In SQL: `\df+ assurance_save_bundle` — execute should be service_role only.
