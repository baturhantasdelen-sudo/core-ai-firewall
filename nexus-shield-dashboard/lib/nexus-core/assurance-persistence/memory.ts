import { createHash } from 'node:crypto';
import type { Evidence, VerificationResult } from '@/lib/nexus-core/outcome/models';
import type {
  AssurancePersistence,
  AssuranceUarRecord,
  IdempotencyRecord,
  PersistScope,
  StoredVerification,
} from '@/lib/nexus-core/assurance-persistence/types';

export class MemoryAssurancePersistence implements AssurancePersistence {
  readonly mode = 'memory' as const;

  private verifications = new Map<string, StoredVerification>();
  private evidenceByVerification = new Map<string, Evidence[]>();
  private uarByVerification = new Map<string, AssuranceUarRecord>();
  private idempotency = new Map<string, IdempotencyRecord & { org_id: string }>();

  saveBundle(scope: PersistScope, result: VerificationResult, uarPayload: Record<string, unknown>): void {
    const stored: StoredVerification = {
      ...result,
      org_id: scope.org_id,
      record_provenance: scope.record_provenance,
    };
    this.verifications.set(result.verification_id, stored);
    this.evidenceByVerification.set(result.verification_id, [...result.evidence]);
    const uar_id = `uar_${result.verification_id}`;
    this.uarByVerification.set(result.verification_id, {
      uar_id,
      verification_id: result.verification_id,
      org_id: scope.org_id,
      uar_version: '2.0',
      verification_status: result.status,
      payload: uarPayload,
      integrity_hash: createHash('sha256').update(JSON.stringify(uarPayload)).digest('hex'),
    });
    if (scope.request_fingerprint && result.idempotency_key) {
      const key = `${scope.org_id}:${result.idempotency_key}`;
      this.idempotency.set(key, {
        org_id: scope.org_id,
        verification_id: result.verification_id,
        request_fingerprint: scope.request_fingerprint,
      });
    }
  }

  getVerification(org_id: string, verification_id: string): StoredVerification | undefined {
    const row = this.verifications.get(verification_id);
    if (!row || row.org_id !== org_id) return undefined;
    return row;
  }

  getEvidence(org_id: string, verification_id: string): Evidence[] {
    const v = this.getVerification(org_id, verification_id);
    if (!v) return [];
    return this.evidenceByVerification.get(verification_id) ?? [];
  }

  getUar(org_id: string, verification_id: string): AssuranceUarRecord | undefined {
    const v = this.getVerification(org_id, verification_id);
    if (!v) return undefined;
    return this.uarByVerification.get(verification_id);
  }

  findIdempotency(org_id: string, idempotency_key: string): IdempotencyRecord | undefined {
    const row = this.idempotency.get(`${org_id}:${idempotency_key}`);
    if (!row) return undefined;
    return { verification_id: row.verification_id, request_fingerprint: row.request_fingerprint };
  }

  resetForTests(): void {
    this.verifications.clear();
    this.evidenceByVerification.clear();
    this.uarByVerification.clear();
    this.idempotency.clear();
  }
}
