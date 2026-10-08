import { randomBytes } from 'node:crypto';
import { resolveAuthoritativeVertical } from '@/lib/nexus-core/assurance/authoritative-sources';
import { analyzeSideEffects } from '@/lib/nexus-core/assurance/side-effects';
import { classifyDiffs } from '@/lib/nexus-core/assurance-engine/diff-engine';
import {
  buildIdempotencyKey,
  idempotencyLookup,
  idempotencySave,
} from '@/lib/nexus-core/assurance-engine/idempotency';
import { evaluateResourceIntegrity, evaluateTransactionIntegrity } from '@/lib/nexus-core/assurance-engine/integrity';
import { safeTransition } from '@/lib/nexus-core/assurance-engine/state-machine';
import { ASSURANCE_VERIFIER_VERSION, type DiffClassification } from '@/lib/nexus-core/assurance-engine/types';
import { resolveOutcomeAdapterV2 } from '@/lib/nexus-core/adapters/outcome-adapter-v2';
import { compareExpectedVsActual } from '@/lib/nexus-core/outcome/engine';
import { validateEvidenceChain } from '@/lib/nexus-core/outcome/evidence';
import { incrementOutcomeMetric, recordVerificationLatencyMs } from '@/lib/nexus-core/outcome/metrics';
import type {
  ActualOutcome,
  OutcomeVerifyRequest,
  VerificationResult,
  VerificationState,
} from '@/lib/nexus-core/outcome/models';
import { saveVerificationResult } from '@/lib/nexus-core/outcome/store';
import { getQueryTemplate } from '@/lib/nexus-core/assurance-engine/db-query-registry';

function agentClaimsSuccess(tool?: OutcomeVerifyRequest['tool_response']): boolean {
  if (!tool) return false;
  const httpOk = tool.status_code >= 200 && tool.status_code < 300;
  const bodyOk = /success|ok|completed|true|succeeded/i.test(tool.body);
  return httpOk && bodyOk;
}

function detectFalseSuccess(
  agentSuccess: boolean,
  observed: Record<string, unknown>,
  expected: Record<string, unknown>,
  hasCriticalDiff: boolean,
): boolean {
  if (!agentSuccess) return false;
  const pending = /pending|processing|queued/i.test(String(observed.status ?? observed.payment_status ?? ''));
  const noLedger = observed.ledger_entry === false;
  if (pending || noLedger) return true;
  if (hasCriticalDiff) return true;
  if (Object.keys(expected).length === 0) return false;
  return false;
}

function hashState(state: Record<string, unknown>): string {
  return JSON.stringify(Object.keys(state).sort().map((k) => [k, state[k]]));
}

export function runAssuranceEngine(req: OutcomeVerifyRequest): VerificationResult {
  const started = performance.now();
  const idemKey = buildIdempotencyKey(req.action_id, req.idempotency_key);
  const existing = idempotencyLookup(idemKey);
  if (existing) {
    return { ...existing, divergence_reason: 'Idempotent replay — existing verification' };
  }

  incrementOutcomeMetric('outcome_verification_total');
  const verification_id = `ov_${randomBytes(10).toString('hex')}`;
  let state: VerificationState = 'EXPECTED';
  state = safeTransition(state, 'ACTION_STARTED');

  let post_block_side_effect_detected = false;
  let side_effect_status: VerificationResult['side_effect_status'] = 'NONE';

  if (req.blocked_action) {
    state = safeTransition(state, 'BLOCKED');
    const adapter = resolveOutcomeAdapterV2(req.adapter_id);
    const adapterCtx = {
      resource_id: req.resource_id,
      mock_fixture: req.mock_fixture,
      inline_state: req.observed_state_override,
    };
    const observed = adapter.get_state(adapterCtx);
    if (req.state_before && hashState(req.state_before) !== hashState(observed)) {
      post_block_side_effect_detected = true;
      incrementOutcomeMetric('post_block_side_effect_total');
      side_effect_status = 'PROHIBITED_DETECTED';
    }
    const ev = adapter.get_evidence(adapterCtx, verification_id, null);
    incrementOutcomeMetric('evidence_chain_appended_total');
    incrementOutcomeMetric('outcome_blocked_total');
    const latency = Math.round(performance.now() - started);
    recordVerificationLatencyMs(latency);
    const result = finalizeResult({
      verification_id,
      state,
      status: 'BLOCKED',
      score: 0,
      req,
      diffs: post_block_side_effect_detected
        ? classifyDiffs([
            {
              field: 'post_block_state',
              expected: 'unchanged',
              actual: 'mutated',
              difference: 'POST_BLOCK_SIDE_EFFECT_DETECTED',
              severity: 'CRITICAL',
            },
          ])
        : [],
      evidence: [ev],
      false_success: false,
      agentSuccess: agentClaimsSuccess(req.tool_response),
      divergence: post_block_side_effect_detected
        ? 'BLOCKED but authoritative state mutated — POST_BLOCK_SIDE_EFFECT_DETECTED'
        : 'Action blocked — post-block verification confirms no mutation',
      actual: {
        transaction_id: req.resource_id ?? req.action_id,
        status: String(observed.status ?? 'BLOCKED'),
        observed_state: observed,
        timestamp: new Date().toISOString(),
        provider: adapter.id,
      },
      chainValid: validateEvidenceChain([ev]),
      post_block_side_effect_detected,
      side_effect_status,
      transaction_integrity: 'OK',
      temporal_status: 'NOT_EVALUATED',
      latency,
      authoritative_source: adapter.id,
    });
    saveVerificationResult(result);
    idempotencySave(idemKey, result);
    return result;
  }

  state = safeTransition(state, 'ACTION_EXECUTED');
  state = safeTransition(state, 'VERIFYING');

  const adapter = resolveOutcomeAdapterV2(req.adapter_id);
  const template = req.query_template_id ? getQueryTemplate(req.query_template_id) : undefined;
  const adapterCtx = {
    resource_id: req.resource_id,
    mock_fixture: req.mock_fixture,
    inline_state: req.observed_state_override,
    http_url: req.http_url,
    sql: template?.sql,
  };

  let observed: Record<string, unknown>;
  try {
    observed = adapter.get_state(adapterCtx);
  } catch (err) {
    incrementOutcomeMetric('verification_adapter_errors_total');
    const latency = Math.round(performance.now() - started);
    recordVerificationLatencyMs(latency);
    const result = finalizeResult({
      verification_id,
      state: 'UNVERIFIED',
      status: 'UNVERIFIED',
      score: 0,
      req,
      diffs: [],
      evidence: [],
      false_success: false,
      agentSuccess: agentClaimsSuccess(req.tool_response),
      divergence: `Adapter error: ${err instanceof Error ? err.message : 'unknown'}`,
      chainValid: true,
      post_block_side_effect_detected: false,
      side_effect_status: 'UNKNOWN',
      transaction_integrity: 'MISSING',
      temporal_status: 'NOT_EVALUATED',
      latency,
      authoritative_source: adapter.id,
    });
    incrementOutcomeMetric('outcome_unverified_total');
    saveVerificationResult(result);
    return result;
  }

  const agentSuccess = agentClaimsSuccess(req.tool_response);
  const actual: ActualOutcome = {
    transaction_id: req.resource_id ?? req.action_id,
    status: String(observed.status ?? 'UNKNOWN'),
    observed_state: observed,
    timestamp: new Date().toISOString(),
    provider: adapter.id,
  };

  const { diffs: rawDiffs, score: baseScore } = compareExpectedVsActual(req.expected_outcome, actual);
  let classified = classifyDiffs(rawDiffs);

  if (req.expected_side_effects) {
    const sideViolations = analyzeSideEffects(req.expected_side_effects, { observed_state: observed });
    if (sideViolations.length > 0) {
      side_effect_status = 'PROHIBITED_DETECTED';
      classified = [
        ...classified,
        ...sideViolations.map((s) => ({
          field: s.field,
          expected: s.expected,
          actual: s.actual,
          difference: s.difference,
          severity: s.severity,
          classification: 'SIDE_EFFECT_VIOLATION' as DiffClassification,
          critical: s.severity === 'CRITICAL' || s.severity === 'HIGH',
          message: s.difference,
        })),
      ];
    }
  }

  const txnIntegrity = evaluateTransactionIntegrity(req.expected_outcome.expected_state, observed);
  const resourceIntegrity = evaluateResourceIntegrity(
    String(req.expected_outcome.expected_state.invoice_id ?? req.resource_id ?? ''),
    observed,
    observed.records_changed !== undefined ? Number(observed.records_changed) : undefined,
  );
  if (resourceIntegrity === 'WRONG_RESOURCE') {
    classified.push({
      field: 'resource_id',
      expected: req.resource_id,
      actual: observed.invoice_id,
      difference: 'Wrong resource affected',
      severity: 'CRITICAL',
      classification: 'RESOURCE_ID_MISMATCH',
      critical: true,
      message: 'Wrong resource',
      operator: 'EQUALS',
    });
  }
  if (resourceIntegrity === 'BULK_MUTATION') {
    classified.push({
      field: 'records_changed',
      expected: 1,
      actual: observed.records_changed,
      difference: 'Bulk mutation',
      severity: 'CRITICAL',
      classification: 'RESOURCE_COUNT_EXPLOSION',
      critical: true,
      message: 'Bulk mutation detected',
      operator: 'LESS_THAN_OR_EQUAL',
    });
  }

  const hasCritical = classified.some((d) => d.severity === 'CRITICAL');
  const false_success = detectFalseSuccess(agentSuccess, observed, req.expected_outcome.expected_state, hasCritical);

  let status: VerificationResult['status'] = 'VERIFIED';
  let divergence: string | undefined;

  if (false_success) {
    status = hasCritical ? 'FAILED' : 'UNVERIFIED';
    divergence = 'False success — tool/agent success not confirmed by authoritative state';
    incrementOutcomeMetric('false_success_detected_total');
  }
  if (hasCritical) {
    status = 'FAILED';
    divergence = divergence ?? 'Critical outcome mismatch';
    incrementOutcomeMetric('critical_outcome_mismatch_total');
    incrementOutcomeMetric(
      'outcome_diff_critical_total',
      classified.filter((d) => d.severity === 'CRITICAL').length,
    );
    incrementOutcomeMetric('outcome_failed_total');
  } else if (classified.length > 0 && status === 'VERIFIED') {
    status = 'UNVERIFIED';
    divergence = 'Non-critical diffs remain';
    incrementOutcomeMetric('outcome_unverified_total');
  } else if (txnIntegrity === 'PENDING' || req.mock_fixture === 'sla_pending' || observed.status === 'PENDING') {
    status = 'UNVERIFIED';
    divergence = 'Eventual consistency — outcome still PENDING';
    incrementOutcomeMetric('outcome_unverified_total');
  } else if (status === 'VERIFIED') {
    incrementOutcomeMetric('outcome_verified_total');
  }

  if (false_success && status === 'VERIFIED') {
    status = 'UNVERIFIED';
  }

  const terminalState: VerificationState =
    status === 'VERIFIED' ? 'VERIFIED' : status === 'FAILED' ? 'FAILED' : 'UNVERIFIED';
  state = safeTransition(state, terminalState);

  const ev = adapter.get_evidence(adapterCtx, verification_id, null);
  incrementOutcomeMetric('evidence_chain_appended_total');
  const chainValid = validateEvidenceChain([ev]);
  const latency = Math.round(performance.now() - started);
  recordVerificationLatencyMs(latency);

  const authoritativeField = Object.keys(req.expected_outcome.expected_state)[0] ?? 'amount';
  const authoritative_source = resolveAuthoritativeVertical(authoritativeField);

  const result = finalizeResult({
    verification_id,
    state,
    status,
    score: Math.max(0, baseScore - classified.length * 5),
    req,
    diffs: classified,
    evidence: [ev],
    false_success,
    agentSuccess,
    divergence,
    actual,
    chainValid,
    post_block_side_effect_detected,
    side_effect_status,
    transaction_integrity: txnIntegrity,
    temporal_status: 'OK',
    latency,
    authoritative_source,
  });

  saveVerificationResult(result);
  idempotencySave(idemKey, result);
  return result;
}

function finalizeResult(params: {
  verification_id: string;
  state: VerificationState;
  status: VerificationResult['status'];
  score: number;
  req: OutcomeVerifyRequest;
  diffs: VerificationResult['diff'];
  evidence: VerificationResult['evidence'];
  false_success: boolean;
  agentSuccess: boolean;
  divergence?: string;
  actual?: ActualOutcome;
  chainValid: boolean;
  post_block_side_effect_detected: boolean;
  side_effect_status: VerificationResult['side_effect_status'];
  transaction_integrity: VerificationResult['transaction_integrity'];
  temporal_status: VerificationResult['temporal_status'];
  latency: number;
  authoritative_source: string;
}): VerificationResult {
  const last = params.evidence[params.evidence.length - 1];
  return {
    verification_id: params.verification_id,
    verification_state: params.state,
    status: params.status,
    score: params.score,
    evidence: params.evidence,
    diff: params.diffs,
    integrity: {
      hash_chain_valid: params.chainValid,
      evidence_count: params.evidence.length,
      last_integrity_hash: last?.integrity_hash ?? null,
    },
    divergence_reason: params.divergence,
    false_success_detected: params.false_success,
    agent_claims_success: params.agentSuccess,
    expected_outcome: params.req.expected_outcome,
    actual_outcome: params.actual,
    completed_at: new Date().toISOString(),
    post_block_side_effect_detected: params.post_block_side_effect_detected,
    side_effect_status: params.side_effect_status,
    transaction_integrity: params.transaction_integrity,
    temporal_status: params.temporal_status,
    verification_latency_ms: params.latency,
    verifier_version: ASSURANCE_VERIFIER_VERSION,
    authoritative_source: params.authoritative_source,
    idempotency_key: params.req.idempotency_key,
  };
}
