import { classifyStoredProvenance } from '@/lib/nexus-core/assurance-persistence/provenance';
import type { RecordProvenance } from '@/lib/nexus-core/assurance-persistence/types';
import {
  getVerificationEvidence,
  getVerificationResult,
  getVerificationUar,
} from '@/lib/nexus-core/outcome/store';
import type { VerificationResult } from '@/lib/nexus-core/outcome/models';

export interface VerificationProofPayload {
  record_type: RecordProvenance;
  verification: VerificationResult;
  verification_status: VerificationResult['status'];
  false_success_detected: boolean;
  post_block_side_effect_detected: boolean;
  outcome_diff: VerificationResult['diff'];
  evidence: VerificationResult['evidence'];
  evidence_ids: string[];
  integrity: VerificationResult['integrity'];
  uar: ReturnType<typeof getVerificationUar> | null;
  provenance_note: string;
}

export function loadVerificationProof(org_id: string, verification_id: string): VerificationProofPayload | null {
  const verification = getVerificationResult(verification_id, org_id);
  if (!verification) return null;

  const stored = verification as VerificationResult & { record_provenance?: RecordProvenance };
  const record_type = classifyStoredProvenance(stored.record_provenance);
  const evidence = getVerificationEvidence(verification_id, org_id);
  const uar = getVerificationUar(verification_id, org_id) ?? null;

  return {
    record_type,
    verification,
    verification_status: verification.status,
    false_success_detected: verification.false_success_detected,
    post_block_side_effect_detected: verification.post_block_side_effect_detected ?? false,
    outcome_diff: verification.diff,
    evidence: evidence.length > 0 ? evidence : verification.evidence,
    evidence_ids: (evidence.length > 0 ? evidence : verification.evidence).map((e) => e.evidence_id),
    integrity: verification.integrity,
    uar,
    provenance_note:
      record_type === 'REAL'
        ? 'Persisted verification produced by the server assurance engine with linked evidence.'
        : record_type === 'DEMO'
          ? 'Deterministic demonstration fixture — not a live enterprise transaction.'
          : 'Provenance unknown — displayed conservatively.',
  };
}
