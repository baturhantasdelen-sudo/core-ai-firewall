import {
  buildVerificationRequestFingerprint,
  deriveRecordProvenance,
  initAssurancePersistence,
  type PersistScope,
} from '@/lib/nexus-core/assurance-persistence';
import { useSupabaseAssurancePersistence } from '@/lib/nexus-core/assurance-persistence/supabase';
import type { OutcomeVerifyRequest, VerificationResult } from '@/lib/nexus-core/outcome/models';
import { runAssuranceEngine } from '@/lib/nexus-core/assurance-engine/engine';
import { enrichRequestWithFinanceErpObservation } from '@/lib/nexus-core/outcome/finance-erp-async';
import {
  persistVerificationAsync,
  resolveIdempotentVerificationAsync,
} from '@/lib/nexus-core/outcome/persist-async';
import { cacheVerificationResult } from '@/lib/nexus-core/outcome/store';

let persistenceBootstrapped = false;

export function ensureAssurancePersistenceBootstrapped(): void {
  if (persistenceBootstrapped) return;
  if (process.env.NODE_ENV === 'test') {
    initAssurancePersistence({ mode: 'memory' });
  } else {
    initAssurancePersistence();
  }
  persistenceBootstrapped = true;
}

export function buildPersistScope(org_id: string, req: OutcomeVerifyRequest): PersistScope {
  return {
    org_id,
    agent_id: req.agent_id,
    action_id: req.action_id,
    adapter_id: req.adapter_id,
    mock_fixture: req.mock_fixture,
    record_provenance: deriveRecordProvenance(req),
    request_fingerprint: buildVerificationRequestFingerprint(req),
    environment: process.env.NEXUS_FINANCE_ERP_ENV ?? process.env.NODE_ENV ?? 'development',
  };
}

export async function runOutcomeVerificationForOrganization(
  org_id: string,
  req: OutcomeVerifyRequest,
): Promise<VerificationResult> {
  ensureAssurancePersistenceBootstrapped();
  let enriched = req;
  try {
    enriched = await enrichRequestWithFinanceErpObservation(req);
  } catch (err) {
    if (req.adapter_id === 'finance_erp_http' && !req.mock_fixture && !req.observed_state_override) {
      return {
        verification_id: `ov_unconfigured_${Date.now()}`,
        verification_state: 'UNVERIFIED',
        status: 'UNVERIFIED',
        score: 0,
        evidence: [],
        diff: [],
        integrity: { hash_chain_valid: true, evidence_count: 0, last_integrity_hash: null },
        false_success_detected: false,
        agent_claims_success: false,
        expected_outcome: req.expected_outcome,
        completed_at: new Date().toISOString(),
        divergence_reason: err instanceof Error ? err.message : 'Finance ERP observer unavailable',
      };
    }
  }

  const scope = buildPersistScope(org_id, enriched);
  const idempotent = await resolveIdempotentVerificationAsync(scope, enriched.idempotency_key);
  if (idempotent) {
    cacheVerificationResult(idempotent);
    return idempotent;
  }

  const skipDurable = useSupabaseAssurancePersistence();
  const result = runAssuranceEngine(enriched, scope, { skipDurable });
  const persisted = await persistVerificationAsync(scope, result);
  cacheVerificationResult(persisted);
  return persisted;
}

/** @deprecated Use async runOutcomeVerificationForOrganization */
export function runOutcomeVerificationForOrganizationSync(
  org_id: string,
  req: OutcomeVerifyRequest,
): VerificationResult {
  ensureAssurancePersistenceBootstrapped();
  const scope = buildPersistScope(org_id, req);
  return runAssuranceEngine(req, scope);
}
