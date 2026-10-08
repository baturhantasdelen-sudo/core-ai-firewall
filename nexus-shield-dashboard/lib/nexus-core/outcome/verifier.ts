import { runAssuranceEngine } from '@/lib/nexus-core/assurance-engine/engine';
import type { OutcomeVerifyRequest, VerificationPlan, VerificationResult } from '@/lib/nexus-core/outcome/models';

const DEFAULT_INTERVALS = [2000, 5000, 10000, 20000, 30000];

export function defaultVerificationPlan(): VerificationPlan {
  return {
    sources: ['adapter'],
    required_sources: ['adapter'],
    timeout_ms: 60000,
    polling: { strategy: 'exponential', intervals_ms: DEFAULT_INTERVALS },
  };
}

export function runOutcomeVerificationSync(req: OutcomeVerifyRequest): VerificationResult {
  return runAssuranceEngine(req);
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
