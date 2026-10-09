import { classifyStoredProvenance } from '@/lib/nexus-core/assurance-persistence/provenance';
import { useSupabaseAssurancePersistence } from '@/lib/nexus-core/assurance-persistence/supabase';
import type { RecordProvenance } from '@/lib/nexus-core/assurance-persistence/types';
import { validateEvidenceChain } from '@/lib/nexus-core/outcome/evidence';
import { loadVerificationForOrgAsync } from '@/lib/nexus-core/outcome/persist-async';
import {
  getVerificationEvidence,
  getVerificationResult,
  getVerificationUar,
} from '@/lib/nexus-core/outcome/store';
import type { VerificationResult } from '@/lib/nexus-core/outcome/models';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getSupabaseAssurancePersistence } from '@/lib/nexus-core/assurance-persistence/supabase';

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
  uar: Awaited<ReturnType<typeof getVerificationUar>> | null;
  provenance_note: string;
  hash_chain_valid: boolean;
  signature_status: 'NOT_APPLICABLE';
}

export async function loadVerificationProof(
  org_id: string,
  verification_id: string,
): Promise<VerificationProofPayload | null> {
  let verification = await loadVerificationForOrgAsync(org_id, verification_id);
  if (!verification) {
    verification = getVerificationResult(verification_id, org_id);
  }
  if (!verification) return null;

  let evidence = getVerificationEvidence(verification_id, org_id);
  let uar: Awaited<ReturnType<typeof getVerificationUar>> | null =
    getVerificationUar(verification_id, org_id) ?? null;

  if (useSupabaseAssurancePersistence()) {
    const store = getSupabaseAssurancePersistence(getSupabaseAdmin());
    evidence = await store.getEvidence(org_id, verification_id);
    uar = (await store.getUar(org_id, verification_id)) ?? null;
    if (evidence.length > 0) {
      verification = { ...verification, evidence };
    }
  }

  const stored = verification as VerificationResult & { record_provenance?: RecordProvenance };
  const record_type = classifyStoredProvenance(stored.record_provenance);
  const chainValid = validateEvidenceChain(
    evidence.length > 0 ? evidence : verification.evidence,
  );

  return {
    record_type,
    verification,
    verification_status: verification.status,
    false_success_detected: verification.false_success_detected,
    post_block_side_effect_detected: verification.post_block_side_effect_detected ?? false,
    outcome_diff: verification.diff,
    evidence: evidence.length > 0 ? evidence : verification.evidence,
    evidence_ids: (evidence.length > 0 ? evidence : verification.evidence).map((e) => e.evidence_id),
    integrity: {
      ...verification.integrity,
      hash_chain_valid: chainValid,
    },
    uar: uar ?? null,
    hash_chain_valid: chainValid,
    signature_status: 'NOT_APPLICABLE',
    provenance_note:
      record_type === 'REAL'
        ? 'Persisted verification produced by the server assurance engine with linked evidence.'
        : record_type === 'DEMO'
          ? 'Deterministic demonstration fixture — not a live enterprise transaction.'
          : 'Provenance unknown — displayed conservatively.',
  };
}
