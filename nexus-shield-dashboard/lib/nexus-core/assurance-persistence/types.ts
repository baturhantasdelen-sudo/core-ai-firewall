import type { Evidence, VerificationResult } from '@/lib/nexus-core/outcome/models';

export type RecordProvenance = 'REAL' | 'DEMO' | 'ESTIMATE' | 'UNKNOWN';

export interface PersistScope {
  org_id: string;
  record_provenance: RecordProvenance;
  request_fingerprint: string;
  agent_id: string;
  action_id: string;
  adapter_id?: string;
  mock_fixture?: string;
  environment?: string;
}

export interface StoredVerification extends VerificationResult {
  org_id: string;
  record_provenance: RecordProvenance;
}

export interface AssuranceUarRecord {
  uar_id: string;
  verification_id: string;
  org_id: string;
  uar_version: string;
  verification_status: string;
  payload: Record<string, unknown>;
  integrity_hash: string;
}

export interface IdempotencyRecord {
  verification_id: string;
  request_fingerprint: string;
}

export interface AssurancePersistence {
  readonly mode: 'sqlite' | 'memory' | 'supabase';

  saveBundle(
    scope: PersistScope,
    result: VerificationResult,
    uarPayload: Record<string, unknown>,
  ): void;

  getVerification(org_id: string, verification_id: string): StoredVerification | undefined;

  getEvidence(org_id: string, verification_id: string): Evidence[];

  getUar(org_id: string, verification_id: string): AssuranceUarRecord | undefined;

  findIdempotency(
    org_id: string,
    idempotency_key: string,
  ): IdempotencyRecord | undefined;

  resetForTests(): void;
}

export class PersistenceUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PersistenceUnavailableError';
  }
}

export class IdempotencyConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IdempotencyConflictError';
  }
}
