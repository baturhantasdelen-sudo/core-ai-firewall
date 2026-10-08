import type { VerificationResult } from '@/lib/nexus-core/outcome/models';

export function buildUarV2OutcomeExtension(result: VerificationResult) {
  return {
    verification_status: result.status,
    verification_id: result.verification_id,
    evidence_ids: result.evidence.map((e) => e.evidence_id),
    outcome_diff: result.diff,
    score: result.score,
    false_success_detected: result.false_success_detected,
    authoritative_source: result.authoritative_source,
    side_effect_status: result.side_effect_status,
    transaction_integrity: result.transaction_integrity,
    temporal_status: result.temporal_status,
    post_block_status: result.post_block_side_effect_detected
      ? 'POST_BLOCK_SIDE_EFFECT_DETECTED'
      : result.status === 'BLOCKED'
        ? 'NO_SIDE_EFFECT'
        : undefined,
    verifier_version: result.verifier_version,
    integrity: result.integrity,
  };
}
