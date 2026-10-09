import type { SupabaseClient } from '@supabase/supabase-js';
import type { Evidence, VerificationResult } from '@/lib/nexus-core/outcome/models';
import { buildUarV2OutcomeExtension } from '@/lib/nexus-core/outcome/uar-bridge';
import { buildSupabaseBundlePayload } from '@/lib/nexus-core/assurance-persistence/bundle-payload';
import { incrementAssurancePersistenceMetric } from '@/lib/nexus-core/assurance-persistence/metrics';
import {
  IdempotencyConflictError,
  type AssuranceUarRecord,
  type IdempotencyRecord,
  type PersistScope,
  type StoredVerification,
} from '@/lib/nexus-core/assurance-persistence/types';

export function useSupabaseAssurancePersistence(): boolean {
  return process.env.NEXUS_ASSURANCE_USE_SUPABASE === 'true';
}

export class SupabaseAssurancePersistence {
  readonly mode = 'supabase' as const;

  constructor(private readonly client: SupabaseClient) {}

  async findIdempotency(org_id: string, idempotency_key: string): Promise<IdempotencyRecord | undefined> {
    const { data, error } = await this.client
      .from('assurance_idempotency')
      .select('request_fingerprint, verification_id')
      .eq('org_id', org_id)
      .eq('idempotency_key', idempotency_key)
      .maybeSingle();
    if (error) throw new Error(`Idempotency lookup failed: ${error.message}`);
    if (!data) return undefined;
    return data as IdempotencyRecord;
  }

  async saveBundle(
    scope: PersistScope,
    result: VerificationResult,
    uarPayload?: Record<string, unknown>,
  ): Promise<void> {
    if (result.idempotency_key) {
      const existing = await this.findIdempotency(scope.org_id, result.idempotency_key);
      if (existing) {
        if (existing.request_fingerprint !== scope.request_fingerprint) {
          incrementAssurancePersistenceMetric('idempotency_conflict_total');
          throw new IdempotencyConflictError('Idempotency key reused with different payload');
        }
        return;
      }
    }

    const payload = uarPayload ?? (buildUarV2OutcomeExtension(result) as Record<string, unknown>);
    const p_bundle = buildSupabaseBundlePayload(scope, result, payload);

    const { data, error } = await this.client.rpc('assurance_save_bundle', { p_bundle });

    if (!error && data && typeof data === 'object' && (data as { status?: string }).status === 'idempotent_replay') {
      incrementAssurancePersistenceMetric('persistence_commit_total');
      return;
    }

    if (error) {
      incrementAssurancePersistenceMetric('persistence_rollback_total');
      if (
        error.message.includes('assurance_idempotency_conflict') ||
        error.code === '23505'
      ) {
        incrementAssurancePersistenceMetric('idempotency_conflict_total');
        throw new IdempotencyConflictError('Idempotency key reused with different payload');
      }
      throw new Error(`assurance_save_bundle failed: ${error.message}`);
    }

    incrementAssurancePersistenceMetric('persistence_commit_total');
  }

  async getVerification(org_id: string, verification_id: string): Promise<StoredVerification | undefined> {
    const { data, error } = await this.client
      .from('assurance_verifications')
      .select('*')
      .eq('verification_id', verification_id)
      .eq('org_id', org_id)
      .maybeSingle();
    if (error) throw new Error(`Verification load failed: ${error.message}`);
    if (!data) return undefined;
    return rowToStoredVerification(data as Record<string, unknown>);
  }

  async getEvidence(org_id: string, verification_id: string): Promise<Evidence[]> {
    const { data, error } = await this.client
      .from('assurance_evidence')
      .select('*')
      .eq('verification_id', verification_id)
      .eq('org_id', org_id);
    if (error) throw new Error(`Evidence load failed: ${error.message}`);
    return (data ?? []).map((row) => evidenceFromRow(row as Record<string, unknown>));
  }

  async getUar(org_id: string, verification_id: string): Promise<AssuranceUarRecord | undefined> {
    const { data, error } = await this.client
      .from('assurance_uar')
      .select('*')
      .eq('verification_id', verification_id)
      .eq('org_id', org_id)
      .maybeSingle();
    if (error) throw new Error(`UAR load failed: ${error.message}`);
    if (!data) return undefined;
    const row = data as Record<string, unknown>;
    return {
      uar_id: String(row.uar_id),
      verification_id: String(row.verification_id),
      org_id: String(row.org_id),
      uar_version: String(row.uar_version ?? '2.0'),
      verification_status: String(row.verification_status),
      payload: row.payload as Record<string, unknown>,
      integrity_hash: String(row.integrity_hash),
    };
  }

  async resetForTests(): Promise<void> {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('resetForTests only allowed in test');
    }
  }
}

function evidenceFromRow(row: Record<string, unknown>): Evidence {
  return {
    evidence_id: String(row.evidence_id),
    verification_id: String(row.verification_id),
    source: String(row.source),
    source_type: String(row.source_type),
    resource: String(row.resource),
    resource_id: String(row.resource_id),
    observed_state_hash: String(row.observed_state_hash),
    observed_at: String(row.observed_at),
    adapter: String(row.adapter),
    query_fingerprint: String(row.query_fingerprint),
    integrity_hash: String(row.integrity_hash),
    previous_hash: (row.previous_hash as string | null) ?? null,
  };
}

function rowToStoredVerification(row: Record<string, unknown>): StoredVerification {
  return {
    verification_id: String(row.verification_id),
    verification_state: row.verification_state as StoredVerification['verification_state'],
    status: row.status as StoredVerification['status'],
    score: 100,
    evidence: [],
    diff: (row.outcome_diff as StoredVerification['diff']) ?? [],
    integrity: (row.integrity as StoredVerification['integrity']) ?? {
      hash_chain_valid: true,
      evidence_count: 0,
      last_integrity_hash: null,
    },
    divergence_reason: row.divergence_reason as string | undefined,
    false_success_detected: Boolean(row.false_success_detected),
    agent_claims_success: false,
    expected_outcome: row.expected_outcome as StoredVerification['expected_outcome'],
    actual_outcome: row.actual_outcome as StoredVerification['actual_outcome'],
    completed_at: String(row.completed_at ?? new Date().toISOString()),
    post_block_side_effect_detected: Boolean(row.post_block_side_effect_detected),
    side_effect_status: row.side_effect_status as StoredVerification['side_effect_status'],
    transaction_integrity: row.transaction_integrity as StoredVerification['transaction_integrity'],
    temporal_status: row.temporal_status as StoredVerification['temporal_status'],
    verification_latency_ms: row.verification_latency_ms as number | undefined,
    verifier_version: row.verifier_version as string | undefined,
    authoritative_source: row.authoritative_source as string | undefined,
    idempotency_key: row.idempotency_key as string | undefined,
    org_id: String(row.org_id),
    record_provenance: row.record_provenance as StoredVerification['record_provenance'],
  };
}

let supabaseInstance: SupabaseAssurancePersistence | null = null;

export function getSupabaseAssurancePersistence(client: SupabaseClient): SupabaseAssurancePersistence {
  if (!supabaseInstance) supabaseInstance = new SupabaseAssurancePersistence(client);
  return supabaseInstance;
}

export function resetSupabaseAssurancePersistenceForTests(): void {
  supabaseInstance = null;
}
