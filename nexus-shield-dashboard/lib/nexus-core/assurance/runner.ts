import { evaluateAssuranceRules } from '@/lib/nexus-core/assurance/engine';
import { analyzeSideEffects, mergeSideEffectViolations } from '@/lib/nexus-core/assurance/side-effects';
import type {
  ActualSideEffects,
  AssuranceEvaluationResult,
  AssuranceRuleGroup,
  ExpectedSideEffects,
} from '@/lib/nexus-core/assurance/types';

export interface AssuranceRunInput {
  observed_state: Record<string, unknown>;
  rules: AssuranceRuleGroup;
  expected_side_effects?: ExpectedSideEffects;
  tool_response?: { status_code: number; body: string };
}

export function detectAssuranceFalseSuccess(
  tool: AssuranceRunInput['tool_response'],
  state: Record<string, unknown>,
): boolean {
  if (!tool) return false;
  const httpOk = tool.status_code >= 200 && tool.status_code < 300;
  const bodyOk = /success|ok|completed|true|succeeded/i.test(tool.body);
  if (!httpOk || !bodyOk) return false;
  const pending = /pending|processing|queued/i.test(String(state.payment_status ?? state.status ?? ''));
  const noLedger = state.ledger_entry === false;
  return pending || noLedger;
}

export function runAssuranceVerification(input: AssuranceRunInput): AssuranceEvaluationResult & {
  false_success_detected: boolean;
  status: 'VERIFIED' | 'UNVERIFIED' | 'FAILED';
} {
  const base = evaluateAssuranceRules(input.observed_state, input.rules);
  const side = input.expected_side_effects
    ? analyzeSideEffects(input.expected_side_effects, {
        observed_state: input.observed_state,
        bulk_update_detected: input.observed_state._bulk_update === true,
      } satisfies ActualSideEffects)
    : [];

  let claim_diffs = mergeSideEffectViolations(base.claim_diffs, side);
  if (input.observed_state._bulk_update === true) {
    claim_diffs = mergeSideEffectViolations(claim_diffs, [
      {
        field: '_bulk',
        expected: false,
        actual: true,
        difference: 'Bulk update detected',
        severity: 'CRITICAL',
        authoritative_vertical: 'database',
      },
    ]);
  }
  const false_success = detectAssuranceFalseSuccess(input.tool_response, input.observed_state);
  const critical = claim_diffs.some((d) => d.severity === 'CRITICAL');

  let status: 'VERIFIED' | 'UNVERIFIED' | 'FAILED' = 'VERIFIED';
  if (false_success) status = 'UNVERIFIED';
  else if (critical) status = 'FAILED';
  else if (claim_diffs.length > 0) status = 'UNVERIFIED';

  const score = Math.max(0, base.score - side.length * 5 - (false_success ? 30 : 0));

  return {
    passed: status === 'VERIFIED',
    score,
    claim_diffs,
    side_effect_violations: side,
    false_success_detected: false_success,
    status,
  };
}
