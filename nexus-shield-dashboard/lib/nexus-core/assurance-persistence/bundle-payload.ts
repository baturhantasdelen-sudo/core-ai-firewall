import { createHash } from 'node:crypto';
import type { Evidence, VerificationResult } from '@/lib/nexus-core/outcome/models';
import type { PersistScope } from '@/lib/nexus-core/assurance-persistence/types';

export function buildSupabaseBundlePayload(
  scope: PersistScope,
  result: VerificationResult,
  uarPayload: Record<string, unknown>,
): Record<string, unknown> {
  const uar_id = `uar_${result.verification_id}`;
  const integrity_hash = createHash('sha256').update(JSON.stringify(uarPayload)).digest('hex');

  return {
    org_id: scope.org_id,
    verification_id: result.verification_id,
    action_id: scope.action_id,
    agent_id: scope.agent_id,
    request_fingerprint: scope.request_fingerprint,
    idempotency_key: result.idempotency_key ?? null,
    status: result.status,
    verification_state: result.verification_state,
    record_provenance: scope.record_provenance,
    authoritative_source: result.authoritative_source ?? null,
    false_success_detected: result.false_success_detected,
    post_block_side_effect_detected: result.post_block_side_effect_detected ?? false,
    side_effect_status: result.side_effect_status ?? null,
    transaction_integrity: result.transaction_integrity ?? null,
    temporal_status: result.temporal_status ?? null,
    verifier_version: result.verifier_version ?? null,
    verification_latency_ms: result.verification_latency_ms ?? null,
    expected_outcome: result.expected_outcome,
    actual_outcome: result.actual_outcome ?? null,
    outcome_diff: result.diff,
    integrity: result.integrity,
    divergence_reason: result.divergence_reason ?? null,
    adapter_id: scope.adapter_id ?? null,
    mock_fixture: scope.mock_fixture ?? null,
    environment: scope.environment ?? 'sandbox',
    completed_at: result.completed_at,
    lifecycle_from_state: 'EXPECTED',
    evidence: result.evidence.map((ev) => evidenceToJson(ev, scope.org_id)),
    uar: {
      uar_id,
      uar_version: '2.0',
      verification_status: result.status,
      payload: uarPayload,
      integrity_hash,
    },
  };
}

function evidenceToJson(ev: Evidence, org_id: string) {
  return {
    evidence_id: ev.evidence_id,
    org_id,
    source: ev.source,
    source_type: ev.source_type,
    resource: ev.resource,
    resource_id: ev.resource_id,
    observed_state_hash: ev.observed_state_hash,
    observed_at: ev.observed_at,
    adapter: ev.adapter,
    query_fingerprint: ev.query_fingerprint,
    integrity_hash: ev.integrity_hash,
    previous_hash: ev.previous_hash,
    sensitivity_classification: 'internal',
    metadata: {},
  };
}
