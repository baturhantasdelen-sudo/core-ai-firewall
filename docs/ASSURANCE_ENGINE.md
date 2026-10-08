# Nexus Shield — Agent Outcome Assurance Engine

## Principle

**Do not trust the agent. Do not trust the tool response. Verify the world.**

Authorization (`POST /api/v1/action/evaluate`) is separate from outcome verification (`POST /api/v1/outcome/verify`).

## Lifecycle

```
EXPECTED → ACTION_STARTED → ACTION_EXECUTED → VERIFYING → VERIFIED | FAILED | UNVERIFIED
BLOCKED → (optional post-block observe) → BLOCKED [+ POST_BLOCK_SIDE_EFFECT_DETECTED]
```

## External status model

| Status | Meaning |
|--------|---------|
| **VERIFIED** | Authoritative observation matches expected outcome; integrity checks pass |
| **UNVERIFIED** | Insufficient or pending authoritative evidence — **not success** |
| **FAILED** | World observed and does not match expected outcome |
| **BLOCKED** | Policy prevented the action |

## Orchestrator

`lib/nexus-core/assurance-engine/engine.ts` — `runAssuranceEngine()`:

- Idempotency (`idempotency_key` + `action_id`)
- Adapter read-only observation
- Deterministic compare (`outcome/engine.ts`) + classified diffs (`assurance-engine/diff-engine.ts`)
- False success detection (tool HTTP success vs authoritative state)
- Post-block side-effect detection (`state_before` vs observed)
- Evidence chain append (`outcome/evidence.ts`)
- Metrics (`outcome/metrics.ts`)

## Adapters (read-only)

| Adapter | ID | Notes |
|---------|-----|-------|
| Mock | `mock` | Deterministic fixtures for tests/demos |
| Generic HTTP | `generic_http` | GET/HEAD only; allowlist + SSRF controls |
| Database | `database` | SELECT-only; registered query templates |
| Inline | `inline` | `observed_state_override` for controlled tests |

## APIs

- `POST /api/v1/outcome/verify` — run verification
- `GET /api/v1/outcome/{verification_id}` — result
- `GET /api/v1/outcome/{verification_id}/evidence` — evidence list
- `GET /api/v1/proof/verification/{verification_id}` — Proof Center backend (`record_type: REAL`)

All require API key authentication.

## Demo flows (deterministic)

See `lib/nexus-core/assurance-engine/demo-scenarios.ts` and tests in `test/assurance-engine-acceptance.test.ts`.

## False success

When `tool_response` indicates success but authoritative state is pending, wrong, or unchanged, `false_success_detected` is set and status is never `VERIFIED`.

## Environment

- `NEXUS_HTTP_VERIFY_ALLOWLIST` — comma-separated hostnames for HTTP adapter
- `NEXUS_HTTP_ALLOW_PRIVATE` — `true` to permit private hosts (non-production only)
- `NEXUS_HTTP_ALLOW_INSECURE` — `true` to permit `http:` URLs

See also: `OUTCOME_VERIFICATION_MODEL.md`, `ASSURANCE_SECURITY_MODEL.md`, `FINAL_ASSURANCE_ENGINE_AUDIT.md`.
