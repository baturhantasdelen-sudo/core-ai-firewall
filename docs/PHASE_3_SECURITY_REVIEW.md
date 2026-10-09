# Phase 3 Security Review

## Verified controls

- Tenant-scoped verification/evidence/UAR reads (`org_id` from API key)
- Cross-tenant IDOR tests (persistence suite)
- Client `record_type` rejected on verify API
- Idempotency fingerprint conflict detection
- SSRF allowlist unchanged on HTTP adapters
- Persistence failure does not return VERIFIED without commit

## Automated tests

- `test/assurance-persistence.test.ts` — restart, IDOR, idempotency
- `test/proof-center-real-data.test.ts` — no fake proof on error
- Existing assurance acceptance SSRF/SQL tests

## Deployment-dependent

- Supabase RLS (tables locked; service role only)
- Network egress to ERP sandbox
- SQLite file permissions on app host

## Residual risks

- Supabase async backend not fully wired in app (SQLite default)
- Live ERP not tested without customer sandbox
- No row-level security on SQLite file (OS-level access control required)

## Untested

- Full Supabase production failover
- DNS rebinding on live HTTP fetch (async path not default in sync engine)
