import { getSupabaseAdmin } from '@/lib/supabase';
import { getAssurancePersistence, type PersistScope } from '@/lib/nexus-core/assurance-persistence';
import { useSupabaseAssurancePersistence } from '@/lib/nexus-core/assurance-persistence/supabase';
import {
  getSupabaseAssurancePersistence,
  resetSupabaseAssurancePersistenceForTests,
} from '@/lib/nexus-core/assurance-persistence/supabase';
import { buildUarV2OutcomeExtension } from '@/lib/nexus-core/outcome/uar-bridge';
import type { VerificationResult } from '@/lib/nexus-core/outcome/models';
import { IdempotencyConflictError } from '@/lib/nexus-core/assurance-persistence/types';
import { incrementAssurancePersistenceMetric } from '@/lib/nexus-core/assurance-persistence/metrics';

export async function resolveIdempotentVerificationAsync(
  scope: PersistScope,
  idempotency_key: string | undefined,
): Promise<VerificationResult | undefined> {
  if (!idempotency_key || !useSupabaseAssurancePersistence()) return undefined;
  const store = getSupabaseAssurancePersistence(getSupabaseAdmin());
  const row = await store.findIdempotency(scope.org_id, idempotency_key);
  if (!row) return undefined;
  if (row.request_fingerprint !== scope.request_fingerprint) {
    throw new IdempotencyConflictError('Idempotency key reused with different payload');
  }
  const existing = await store.getVerification(scope.org_id, row.verification_id);
  if (!existing) return undefined;
  return { ...existing, divergence_reason: 'Idempotent replay — existing verification' };
}

export async function persistVerificationAsync(
  scope: PersistScope,
  result: VerificationResult,
): Promise<VerificationResult> {
  const uarPayload = buildUarV2OutcomeExtension(result) as Record<string, unknown>;
  try {
    if (useSupabaseAssurancePersistence()) {
      await getSupabaseAssurancePersistence(getSupabaseAdmin()).saveBundle(scope, result, uarPayload);
    } else {
      getAssurancePersistence().saveBundle(scope, result, uarPayload);
    }
    return result;
  } catch (err) {
    incrementAssurancePersistenceMetric('persistence_error_total');
    if (err instanceof IdempotencyConflictError) throw err;
    if (result.status === 'VERIFIED' || result.status === 'FAILED' || result.status === 'BLOCKED') {
      return {
        ...result,
        status: 'UNVERIFIED',
        divergence_reason: `Persistence failed: ${err instanceof Error ? err.message : 'unknown'}`,
      };
    }
    throw err;
  }
}

export async function loadVerificationForOrgAsync(
  org_id: string,
  verification_id: string,
): Promise<VerificationResult | undefined> {
  if (useSupabaseAssurancePersistence()) {
    const stored = await getSupabaseAssurancePersistence(getSupabaseAdmin()).getVerification(
      org_id,
      verification_id,
    );
    if (!stored) return undefined;
    const evidence = await getSupabaseAssurancePersistence(getSupabaseAdmin()).getEvidence(
      org_id,
      verification_id,
    );
    return { ...stored, evidence: evidence.length > 0 ? evidence : stored.evidence };
  }
  return getAssurancePersistence().getVerification(org_id, verification_id);
}

export { resetSupabaseAssurancePersistenceForTests };
