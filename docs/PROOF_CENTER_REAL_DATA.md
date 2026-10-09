# Proof Center — Real Data Integration

## Flow

```
verification_id + API key → GET /api/v1/proof/verification/{id}
  → loadVerificationProof(org_id, id)
  → verification + evidence + UAR + integrity + record_type
```

## Record types (server-derived)

| Type | Meaning |
|------|---------|
| REAL | Non-mock adapter or persisted real observer path |
| DEMO | Mock adapter / mock_fixture |
| ESTIMATE | Assessment funnel outputs (not verification proof) |
| UNKNOWN | Missing provenance metadata |

Clients **cannot** set `record_type` on verify (HTTP 400).

## UI

- `components/proof-center/VerificationProofLookup.tsx`
- Routes: `/proof-center`, `/proof-center/verification/[verification_id]`
- On API failure: error message only — **no demo fallback**

## Integrity display

Shows `hash_chain_valid`, evidence count, last integrity hash. Labeled as hash integrity, not digital signature.
