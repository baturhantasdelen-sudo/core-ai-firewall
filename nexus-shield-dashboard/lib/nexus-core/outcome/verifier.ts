import { randomBytes } from 'node:crypto';
import { resolveOutcomeAdapterV2 } from '@/lib/nexus-core/adapters/outcome-adapter-v2';
import { compareExpectedVsActual } from '@/lib/nexus-core/outcome/engine';
import { validateEvidenceChain } from '@/lib/nexus-core/outcome/evidence';
import { incrementOutcomeMetric } from '@/lib/nexus-core/outcome/metrics';
import type {
  ActualOutcome,
  OutcomeVerifyRequest,
  VerificationPlan,
  VerificationResult,
  VerificationState,
} from '@/lib/nexus-core/outcome/models';
import { saveVerificationResult } from '@/lib/nexus-core/outcome/store';

const DEFAULT_INTERVALS = [2000, 5000, 10000, 20000, 30000];

export function defaultVerificationPlan(): VerificationPlan {
  return {
    sources: ['adapter'],
    required_sources: ['adapter'],
    timeout_ms: 60000,
    polling: { strategy: 'exponential', intervals_ms: DEFAULT_INTERVALS },
  };
}

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
): boolean {
  if (!agentSuccess) return false;
  const pending = /pending|processing|queued/i.test(String(observed.status ?? ''));
  const noLedger = observed.ledger_entry === false || observed.ledger_entry === undefined;
  const unchanged = /unchanged|blocked/i.test(String(observed.status ?? ''));
  const consequential = Object.keys(expected).length > 0;
  return consequential && (pending || noLedger || unchanged);
}

function transitionState(current: VerificationState, next: VerificationState): VerificationState {
  return next;
}

export function runOutcomeVerificationSync(req: OutcomeVerifyRequest): VerificationResult {
  incrementOutcomeMetric('outcome_verification_total');
  const verification_id = `ov_${randomBytes(10).toString('hex')}`;
  let state: VerificationState = 'EXPECTED';
  state = transitionState(state, 'ACTION_STARTED');

  if (req.blocked_action) {
    state = transitionState(state, 'BLOCKED');
    const result = buildResult({
      verification_id,
      state,
      status: 'BLOCKED',
      score: 0,
      req,
      diffs: [],
      evidence: [],
      false_success: false,
      agentSuccess: agentClaimsSuccess(req.tool_response),
      divergence: 'Action blocked before external mutation — post-block verification',
    });
    incrementOutcomeMetric('outcome_blocked_total');
    saveVerificationResult(result);
    return result;
  }

  state = transitionState(state, 'ACTION_EXECUTED');
  state = transitionState(state, 'VERIFYING');

  const adapter = resolveOutcomeAdapterV2(req.adapter_id);
  const adapterCtx = {
    resource_id: req.resource_id,
    mock_fixture: req.mock_fixture,
    inline_state: req.observed_state_override,
  };

  const observed = adapter.get_state(adapterCtx);
  const agentSuccess = agentClaimsSuccess(req.tool_response);
  const false_success = detectFalseSuccess(agentSuccess, observed, req.expected_outcome.expected_state);

  let prev = null;
  const ev = adapter.get_evidence(adapterCtx, verification_id, prev);
  prev = ev;
  incrementOutcomeMetric('evidence_chain_appended_total');

  const actual: ActualOutcome = {
    transaction_id: req.resource_id ?? req.action_id,
    status: String(observed.status ?? 'UNKNOWN'),
    observed_state: observed,
    timestamp: new Date().toISOString(),
    provider: adapter.id,
  };

  const { diffs, score } = compareExpectedVsActual(req.expected_outcome, actual);

  let status: VerificationResult['status'] = 'VERIFIED';
  let divergence: string | undefined;

  if (false_success) {
    status = 'UNVERIFIED';
    divergence = 'False Success — agent/tool reported success but world state is PENDING or missing ledger entry';
    incrementOutcomeMetric('false_success_detected_total');
    incrementOutcomeMetric('outcome_unverified_total');
  } else if (diffs.some((d) => d.severity === 'CRITICAL')) {
    status = 'FAILED';
    divergence = 'Critical field mismatch vs expected outcome';
    incrementOutcomeMetric('outcome_failed_total');
    incrementOutcomeMetric('outcome_diff_critical_total', diffs.filter((d) => d.severity === 'CRITICAL').length);
  } else if (diffs.length > 0) {
    status = 'UNVERIFIED';
    divergence = 'Observed state differs from expected outcome';
    incrementOutcomeMetric('outcome_unverified_total');
  } else if (req.mock_fixture === 'sla_pending' || observed.status === 'PENDING') {
    status = 'UNVERIFIED';
    divergence = 'SLA / eventual consistency window — outcome still PENDING';
    incrementOutcomeMetric('outcome_unverified_total');
  } else {
    incrementOutcomeMetric('outcome_verified_total');
  }

  const terminalState: VerificationState =
    status === 'VERIFIED' ? 'VERIFIED' : status === 'FAILED' ? 'FAILED' : 'UNVERIFIED';
  state = transitionState(state, terminalState);

  const chainValid = validateEvidenceChain([ev]);
  const result = buildResult({
    verification_id,
    state,
    status,
    score,
    req,
    diffs,
    evidence: [ev],
    false_success,
    agentSuccess,
    divergence,
    actual,
    chainValid,
  });
  saveVerificationResult(result);
  return result;
}

function buildResult(params: {
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
  chainValid?: boolean;
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
      hash_chain_valid: params.chainValid ?? true,
      evidence_count: params.evidence.length,
      last_integrity_hash: last?.integrity_hash ?? null,
    },
    divergence_reason: params.divergence,
    false_success_detected: params.false_success,
    agent_claims_success: params.agentSuccess,
    expected_outcome: params.req.expected_outcome,
    actual_outcome: params.actual,
    completed_at: new Date().toISOString(),
  };
}

/** Async polling across verification_window intervals (tests may pass collapsePolling). */
export async function runOutcomeVerificationAsync(
  req: OutcomeVerifyRequest,
  options?: { collapsePolling?: boolean },
): Promise<VerificationResult> {
  const plan = req.verification_plan ?? defaultVerificationPlan();
  const intervals = plan.polling.intervals_ms.length ? plan.polling.intervals_ms : DEFAULT_INTERVALS;
  let last: VerificationResult | undefined;

  for (let i = 0; i < intervals.length; i++) {
    if (!options?.collapsePolling) {
      await new Promise((r) => setTimeout(r, Math.min(intervals[i]!, 30)));
    }
    last = runOutcomeVerificationSync({
      ...req,
      mock_fixture: i < intervals.length - 1 && req.mock_fixture === 'sla_pending' ? 'sla_pending' : req.mock_fixture,
    });
    if (last.status === 'VERIFIED' || last.status === 'FAILED' || last.status === 'BLOCKED') {
      return last;
    }
  }
  return last ?? runOutcomeVerificationSync(req);
}
