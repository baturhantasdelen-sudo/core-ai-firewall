# Assurance Engine — Security Model

## Trust boundary

```
Agent / Tool response  ──X──>  not authoritative
Action executor        ──X──>  not independent verifier
Outcome adapter        ──✓──>  read-only observation
Verification engine    ──✓──>  deterministic compare + evidence
```

LLMs do **not** determine `VERIFIED` in this phase.

## Controls implemented

| Threat | Mitigation |
|--------|------------|
| SSRF (HTTP adapter) | Host allowlist, HTTPS default, private IP block, no user-controlled fetch without allowlist |
| SQL injection | SELECT-only regex; `assertRegisteredQuery()` for templates |
| Secret leakage | Evidence uses hashes/canonical JSON; API responses omit credentials |
| IDOR on verification | API key auth on all outcome/proof routes; `verification_id` alone is not authorization |
| Duplicate proof | Idempotency map on `action_id` + optional `idempotency_key` |
| Unbounded polling | Bounded intervals in async verifier; sync path single observation |
| Forged client status | Verification only server-side |

## Failure posture

- Adapter errors → **UNVERIFIED** (not silent success)
- Missing allowlist → HTTP URL rejected
- Non-SELECT SQL → thrown at adapter boundary

## Not claimed

- Ed25519 production signing unless keys are configured (`uar/keys.ts` documents public key id only)
- Multi-tenant durable isolation (in-memory store in dev/test)

## Tests

`test/assurance-engine-acceptance.test.ts` — SSRF, arbitrary SQL, idempotency, acceptance cases A–E.
