# Phase 4.1 — Live Test Results

**Executed:** 2026-10-09 (CI/local default)

## Unit / mock tests (executed)

| Suite | Count | Result |
|-------|-------|--------|
| `test:nexus-core` | **53/53 PASS** (live suite skipped) | Executed 2026-10-09 |
| `test:benchmark` | **7/7 PASS** | Executed |
| `test:marketing` | **6/6 PASS** | Executed |
| Build/typecheck | PASS | Executed |
| Lint | Not run | — |
| E2E | Not run | — |

## Live Supabase integration

| Gate | Status |
|------|--------|
| `NEXUS_ASSURANCE_LIVE_INTEGRATION=true` | **Not set in automation** |
| Real RPC against project DB | **BLOCKED BY CONFIGURATION** |

When enabled, `test/supabase-assurance-live.integration.test.ts` runs:

1. Connectivity
2. Persist + proof load
3. Cross-tenant IDOR denial
4. Idempotency replay

**LIVE PASS requires:** owner applies `schema-assurance.sql` + `schema-assurance-atomic.sql`, sets env vars, runs `NEXUS_ASSURANCE_LIVE_INTEGRATION=true npm run test:nexus-core`.

## Not claimed

- No live Supabase PASS recorded in this repository run without project credentials.
- Transaction failure injection on live DB: manual QA step (documented in CONFIGURATION_GUIDE).
