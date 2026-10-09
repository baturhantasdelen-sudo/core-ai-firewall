import {
  buildVerificationRequestFingerprint,
  deriveRecordProvenance,
  getAssurancePersistence,
  initAssurancePersistence,
  type PersistScope,
} from '@/lib/nexus-core/assurance-persistence';
import type { OutcomeVerifyRequest, VerificationResult } from '@/lib/nexus-core/outcome/models';
import { runAssuranceEngine } from '@/lib/nexus-core/assurance-engine/engine';

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

export function runOutcomeVerificationForOrganization(
  org_id: string,
  req: OutcomeVerifyRequest,
): VerificationResult {
  ensureAssurancePersistenceBootstrapped();
  const scope = buildPersistScope(org_id, req);
  return runAssuranceEngine(req, scope);
}
