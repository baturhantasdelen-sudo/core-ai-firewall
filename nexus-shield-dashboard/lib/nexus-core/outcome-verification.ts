import { createHash } from 'node:crypto';
import { resolveOutcomeAdapter } from '@/lib/nexus-core/adapters/registry';
import type { ExternalStateResult, OutcomeAdapterSystem } from '@/lib/nexus-core/adapters/types';
import type { OutcomeDiff } from '@/lib/nexus-core/outcome/models';
import { defaultVerificationPlan, runOutcomeVerificationSync } from '@/lib/nexus-core/outcome/verifier';
import type { VerifyActionRequest } from '@/lib/nexus-core/types';

export type OutcomeVerificationStatus = 'VERIFIED' | 'UNVERIFIED' | 'BLOCKED';

export interface ExpectedStateSnapshot {
  description: string;
  expected_delta: Record<string, unknown>;
  consequential: boolean;
}

export interface EngineOutcomeVerification {
  status: OutcomeVerificationStatus;
  divergence_reason?: string;
  adapter_system: OutcomeAdapterSystem;
  expected: ExpectedStateSnapshot;
  actual: ExternalStateResult;
  actual_before?: ExternalStateResult;
  api_reports_success: boolean;
  state_delta_observed: boolean;
  false_success_detected: boolean;
  verification_id?: string;
  verification_status?: OutcomeVerificationStatus;
  verification_score?: number;
  evidence_ids?: string[];
  outcome_diff?: OutcomeDiff[];
}

function hashRecord(value: Record<string, unknown>): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function isConsequentialAction(toolName: string, userIntent: string): boolean {
  const haystack = `${toolName} ${userIntent}`.toLowerCase();
  return /refund|payment|transfer|delete|purge|export|execute_payment|process_refund|create_payment|write|update/.test(
    haystack,
  );
}

function inferExpectedDelta(userIntent: string, toolName: string, args: Record<string, unknown>): ExpectedStateSnapshot {
  const consequential = isConsequentialAction(toolName, userIntent);
  const intent = userIntent.toLowerCase();

  if (/refund|process_refund/.test(intent) || /refund/.test(toolName.toLowerCase())) {
    return {
      description: 'Ledger should reflect refund posting',
      expected_delta: { refund_status: 'POSTED', ledger_mutated: true },
      consequential: true,
    };
  }
  if (/payment|pay|execute_payment|create_payment/.test(intent) || /payment/.test(toolName.toLowerCase())) {
    return {
      description: 'Invoice / payment status should change',
      expected_delta: { invoice_paid: true, payment_status: 'PAID' },
      consequential: true,
    };
  }
  if (/delete|purge/.test(intent)) {
    return {
      description: 'Target record should be deleted or tombstoned',
      expected_delta: { is_deleted: true },
      consequential: true,
    };
  }
  if (/export|dump/.test(intent)) {
    return {
      description: 'Egress or export counters should increase',
      expected_delta: { egress_bytes: '>0' },
      consequential: true,
    };
  }

  return {
    description: consequential ? 'State mutation expected for consequential tool' : 'Read-only — no mutation required',
    expected_delta: consequential ? { mutated: true } : {},
    consequential,
  };
}

function stateMatchesExpectation(
  expected: ExpectedStateSnapshot,
  before: Record<string, unknown> | undefined,
  after: Record<string, unknown>,
): boolean {
  if (!expected.consequential) return true;

  if (before && hashRecord(before) === hashRecord(after)) {
    return false;
  }

  for (const [key, value] of Object.entries(expected.expected_delta)) {
    if (value === '>0') {
      const afterNum = Number(after.egress_bytes ?? after.bytes_streamed ?? 0);
      if (!(afterNum > 0)) return false;
      continue;
    }
    if (after[key] !== value && after[key] !== undefined) {
      // Soft match: payment fields may alias
      if (key === 'invoice_paid' && after.payment_status === 'PAID') continue;
      if (key === 'payment_status' && after.invoice_paid === true) continue;
      if (expected.expected_delta.ledger_mutated && after.ledger_balance !== before?.ledger_balance) continue;
    }
  }

  if (expected.expected_delta.ledger_mutated) {
    if (before && after.ledger_balance === before.ledger_balance && after.refund_status === before.refund_status) {
      return false;
    }
  }

  if (expected.expected_delta.invoice_paid === true) {
    if (after.invoice_paid !== true && after.payment_status !== 'PAID' && after.refund_status !== 'POSTED') {
      if (before && hashRecord(before) === hashRecord(after)) return false;
    }
  }

  return !(before && hashRecord(before) === hashRecord(after)) || Object.keys(expected.expected_delta).length === 0;
}

/** Outcome Verification Motor — expected vs actual external state (adapters). */
export function runOutcomeVerificationEngine(req: VerifyActionRequest): EngineOutcomeVerification {
  const adapterSystem = req.outcomeAdapter ?? resolveOutcomeAdapter(undefined, req.toolCall.name, req.userIntent).system;
  const adapter = resolveOutcomeAdapter(adapterSystem, req.toolCall.name, req.userIntent);

  const ctx = {
    agentId: req.agentId,
    toolName: req.toolCall.name,
    toolArgs: req.toolCall.args,
    userIntent: req.userIntent,
    inlineState: req.stateAfter,
    entityIdHint: req.transactionId,
  };

  const actual = adapter.readCurrentState(ctx);
  const actual_before = req.stateBefore
    ? resolveOutcomeAdapter('INLINE_STATE').readCurrentState({ ...ctx, inlineState: req.stateBefore })
    : undefined;

  const expected = inferExpectedDelta(req.userIntent, req.toolCall.name, req.toolCall.args);

  const api_reports_success =
    req.apiResult !== undefined &&
    req.apiResult.status_code >= 200 &&
    req.apiResult.status_code < 300 &&
    /success|ok|completed|true|succeeded/i.test(req.apiResult.body);

  const state_delta_observed =
    req.stateBefore !== undefined && req.stateAfter !== undefined
      ? hashRecord(req.stateBefore) !== hashRecord(req.stateAfter)
      : stateMatchesExpectation(expected, req.stateBefore, actual.current_state);

  let false_success_detected =
    expected.consequential &&
    api_reports_success &&
    !state_delta_observed;

  let status: OutcomeVerificationStatus = 'VERIFIED';
  let divergence_reason: string | undefined;

  if (false_success_detected) {
    status = 'UNVERIFIED';
    divergence_reason = 'False Success / Ghost Action detected — tool HTTP success without ledger/state mutation';
  } else if (expected.consequential && !state_delta_observed && req.stateBefore !== undefined) {
    status = 'UNVERIFIED';
    divergence_reason = 'Expected business state change not observed in outcome adapter read';
  } else if (!expected.consequential && api_reports_success) {
    status = 'VERIFIED';
  }

  const v2 = runOutcomeVerificationSync({
    agent_id: req.agentId,
    action_id: req.transactionId ?? req.toolCall.name,
    expected_outcome: {
      outcome_id: `out_${req.transactionId ?? req.toolCall.name}`,
      action_id: req.transactionId ?? req.toolCall.name,
      type: expected.description,
      expected_state: { ...expected.expected_delta },
    },
    verification_plan: defaultVerificationPlan(),
    adapter_id: 'inline',
    tool_response: req.apiResult
      ? { status_code: req.apiResult.status_code, body: req.apiResult.body }
      : undefined,
    observed_state_override: actual.current_state,
    resource_id: req.transactionId,
  });

  if (v2.false_success_detected && status === 'VERIFIED') {
    status = 'UNVERIFIED';
    divergence_reason = v2.divergence_reason ?? divergence_reason;
    false_success_detected = true;
  } else if (v2.status === 'FAILED' && status === 'VERIFIED') {
    status = 'UNVERIFIED';
    divergence_reason = v2.divergence_reason ?? divergence_reason;
  } else if (v2.status === 'UNVERIFIED' && expected.consequential && status === 'VERIFIED') {
    status = 'UNVERIFIED';
    divergence_reason = v2.divergence_reason ?? divergence_reason;
  }

  const mergedFalseSuccess = false_success_detected || v2.false_success_detected;

  return {
    status,
    divergence_reason,
    adapter_system: adapterSystem,
    expected,
    actual,
    actual_before,
    api_reports_success,
    state_delta_observed,
    false_success_detected: mergedFalseSuccess,
    verification_id: v2.verification_id,
    verification_status: status,
    verification_score: v2.score,
    evidence_ids: v2.evidence.map((e) => e.evidence_id),
    outcome_diff: v2.diff,
  };
}
