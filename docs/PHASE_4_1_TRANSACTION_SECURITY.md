# Phase 4.1 — Transaction Security

## Problem (pre-4.1)

`SupabaseAssurancePersistence.saveBundle` used sequential REST inserts with manual DELETE compensation — not atomic.

## Solution

PostgreSQL RPC `assurance_save_bundle` with:

- `SECURITY DEFINER` + `SET search_path = public`
- `REVOKE ALL` from `PUBLIC`, `anon`, `authenticated`
- `GRANT EXECUTE` to `service_role` only
- Validates `org_id` exists in `organizations` before write
- Idempotency: fingerprint match → replay; mismatch → `assurance_idempotency_conflict`
- `unique_violation` race handling for concurrent duplicate keys

## org_id trust

The RPC accepts `org_id` in JSON but the **application** must only pass server-derived `org_id` from authenticated API key. The RPC validates membership in `organizations` — it does not accept arbitrary client-supplied keys from the browser.

## RLS

Assurance tables: RLS **enabled**, no permissive policies for anon/authenticated — default deny. Service role bypasses RLS for server writes/reads.

## Rollback

Failed RPC → no partial rows committed (single transaction). Application downgrades VERIFIED to UNVERIFIED on persist error.
