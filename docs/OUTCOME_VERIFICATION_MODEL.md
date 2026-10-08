# Outcome Verification Domain Model

Implementation: `nexus-shield-dashboard/lib/nexus-core/outcome/models.ts`

## ExpectedOutcome

Carries `outcome_id`, `action_id`, `type`, `expected_state`, optional `constraints` (ALL/ANY rules with operators), `verification_deadline`, `required_evidence`.

Extended request fields on `OutcomeVerifyRequest`: `resource_id`, `expected_side_effects`, `prohibited_side_effects`, `state_before`, `idempotency_key`, `blocked_action`, `tool_response`, adapter selectors.

## ActualOutcome

`transaction_id`, `status`, `observed_state`, `timestamp`, `provider` — raw sensitive values minimized in evidence via hashes.

## VerificationPlan

Sources, polling strategy, `timeout_ms` — used by async verifier; sync path uses defaults from `defaultVerificationPlan()`.

## VerificationResult

| Field | Purpose |
|-------|---------|
| `status` | VERIFIED \| UNVERIFIED \| FAILED \| BLOCKED |
| `false_success_detected` | Tool/agent success not confirmed |
| `post_block_side_effect_detected` | Blocked action but world mutated |
| `side_effect_status` | Side-effect policy outcome |
| `transaction_integrity` | OK \| PENDING \| MISMATCH \| MISSING |
| `temporal_status` | Time constraint evaluation |
| `authoritative_source` | Vertical/source label (not agent response) |
| `diff` | Classified differences with severity |
| `evidence` | Tamper-evident chain entries |
| `integrity` | Chain validation summary |
| `verification_latency_ms` | Measured wall time |
| `verifier_version` | Assurance engine version string |

## Comparison operators

`EQUALS`, `NOT_EQUALS`, `GREATER_THAN`, `LESS_THAN`, `GREATER_OR_EQUAL`, `LESS_OR_EQUAL`, `IN`, `NOT_IN`, `CONTAINS`, `MATCHES`, `EXISTS`, `NOT_EXISTS` with `ALL` / `ANY` grouping.

## UAR 2.0 bridge

`buildUarV2OutcomeExtension()` attaches verification fields to receipts; UAR references evidence IDs — it is not the verification itself.
