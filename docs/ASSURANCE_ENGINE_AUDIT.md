# Assurance Engine — Repository Audit (Phase A)

**Scope:** Backend assurance / outcome verification (`nexus-shield-dashboard/lib/nexus-core/`).  
**Website:** Already transformed — **do not redesign**; backend makes VERIFY real.

## Existing (reuse)

| Component | Path |
|-----------|------|
| Outcome models & diff | `outcome/models.ts`, `outcome/engine.ts` |
| Verifier (sync/async) | `outcome/verifier.ts` |
| Evidence hash chain | `outcome/evidence.ts` |
| Assurance rules | `assurance/engine.ts`, `assurance/runner.ts` |
| Adapters v2 | `adapters/outcome-adapter-v2.ts` |
| UAR 2.0 | `uar/builder.ts`, `uar/verify.ts` |
| Proof store | `proof/store.ts`, `/api/v1/proof/[transaction_id]` |
| APIs | `POST /api/v1/outcome/verify`, GET outcome + evidence |
| Pipeline | `pipeline.ts` → `runOutcomeVerificationEngine` + UAR 2.0 |
| Tests | `test:nexus-core` (24), `test:benchmark` (20 A2B) |

## Gaps addressed in Phase B–T

- Extended verification result (post-block, transaction/resource integrity, latency, idempotency)
- Central `assurance-engine/` orchestrator with classified diffs
- Mock demo fixtures for finance / ERP acceptance flows
- HTTP allowlist (SSRF) and DB query registry
- Proof API by `verification_id`
- Comprehensive assurance-engine test suite
- Docs: `ASSURANCE_ENGINE.md`, `OUTCOME_VERIFICATION_MODEL.md`, `ASSURANCE_SECURITY_MODEL.md`

## Compatibility

- `POST /api/v1/action/evaluate` unchanged contract; optional richer proof via existing pipeline
- Outcome verify API extended with optional `idempotency_key`, `state_before` (additive)

## Risks

- In-memory stores (verification, proof) — production would use durable DB; documented as limitation
- Generic HTTP adapter: no fetch until allowlisted URL configured
