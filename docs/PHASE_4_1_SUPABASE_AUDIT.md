# Phase 4.1 — Supabase Assurance Audit

## Persistence call graph

```
POST /api/v1/outcome/verify
  → authenticateApiKey → org.id
  → runOutcomeVerificationForOrganization(org.id, req)
      → assertAssuranceConfigOrThrow() (non-test)
      → runAssuranceEngine (optional skipDurable when Supabase)
      → persistVerificationAsync
          → SupabaseAssurancePersistence.saveBundle
              → rpc('assurance_save_bundle', { p_bundle })  [atomic]
GET /api/v1/proof/verification/{id}
  → loadVerificationProof(org.id, id) → Supabase SELECT (tenant filtered)
```

## Tables (`schema-assurance.sql`)

| Table | Purpose |
|-------|---------|
| `assurance_verifications` | Primary verification record |
| `assurance_evidence` | FK → verification, org |
| `assurance_uar` | FK → verification, unique per verification |
| `assurance_idempotency` | PK `(org_id, idempotency_key)` |
| `assurance_lifecycle_events` | State transition audit |

## Atomic write (`schema-assurance-atomic.sql`)

Single function `public.assurance_save_bundle(jsonb)` — one transaction, all inserts, idempotency handling, org existence check.

## Application modules

- `supabase.ts` — RPC client adapter (no multi-request compensation)
- `bundle-payload.ts` — canonical JSON bundle
- `config.ts` — fail-closed env validation
- `persist-async.ts` — orchestration

## Tenant model

`org_id` from API key lookup only — never from client body for authorization.
