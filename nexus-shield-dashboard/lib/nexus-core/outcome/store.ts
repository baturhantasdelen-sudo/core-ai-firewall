import { buildUarV2OutcomeExtension } from '@/lib/nexus-core/outcome/uar-bridge';
import type { VerificationResult } from '@/lib/nexus-core/outcome/models';
import {
  getAssurancePersistence,
  type PersistScope,
} from '@/lib/nexus-core/assurance-persistence';
import { incrementAssurancePersistenceMetric } from '@/lib/nexus-core/assurance-persistence/metrics';
import { IdempotencyConflictError } from '@/lib/nexus-core/assurance-persistence/types';

const verificationCache = new Map<string, VerificationResult>();

export function cacheVerificationResult(result: VerificationResult): void {
  verificationCache.set(result.verification_id, result);
}

export function saveVerificationResult(
  result: VerificationResult,
  scope?: PersistScope,
): void {
  verificationCache.set(result.verification_id, result);
  if (!scope) return;

  const uarPayload = buildUarV2OutcomeExtension(result);
  try {
    getAssurancePersistence().saveBundle(scope, result, uarPayload as Record<string, unknown>);
  } catch (err) {
    incrementAssurancePersistenceMetric('persistence_error_total');
    if (err instanceof IdempotencyConflictError) throw err;
    throw err;
  }
}

export function getVerificationResult(
  verification_id: string,
  org_id?: string,
): VerificationResult | undefined {
  if (org_id) {
    const stored = getAssurancePersistence().getVerification(org_id, verification_id);
    if (stored) return stored;
    return undefined;
  }
  return verificationCache.get(verification_id);
}

export function getVerificationEvidence(verification_id: string, org_id: string) {
  return getAssurancePersistence().getEvidence(org_id, verification_id);
}

export function getVerificationUar(verification_id: string, org_id: string) {
  return getAssurancePersistence().getUar(org_id, verification_id);
}

export function clearVerificationStoreForTests(): void {
  verificationCache.clear();
}
