import type { VerificationResult } from '@/lib/nexus-core/outcome/models';

export function buildUarV2OutcomeExtension(result: VerificationResult) {
  return {
    verification_status: result.status,
    verification_id: result.verification_id,
    evidence_ids: result.evidence.map((e) => e.evidence_id),
    outcome_diff: result.diff,
    score: result.score,
    false_success_detected: result.false_success_detected,
  };
}
