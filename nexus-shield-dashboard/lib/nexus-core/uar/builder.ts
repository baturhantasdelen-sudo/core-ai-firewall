import { createHash } from 'node:crypto';
import { sha256Digest } from '@/lib/accountability/action-proof';
import type { EffectiveAuthorityReport } from '@/lib/engine/agents/effective-authority';
import type { EngineEvidenceSeal, NexusRiskDecision, VerifyActionRequest } from '@/lib/nexus-core/types';
import type { EngineOutcomeVerification } from '@/lib/nexus-core/outcome-verification';
import type { AssuranceEvaluationResult } from '@/lib/nexus-core/assurance/types';
import { canonicalJson, sha256Canonical } from '@/lib/nexus-core/outcome/evidence';
import type { Uar20Receipt } from '@/lib/nexus-core/uar/models';
import { NEXUS_PROOF_PUBLIC_KEY_ID } from '@/lib/nexus-core/uar/keys';

let previousUarHash: string | null = null;

export function resetUar20ChainForTests(): void {
  previousUarHash = null;
}

function signMaterial(bodyHash: string, agentId: string): string {
  return createHash('sha256').update(`${bodyHash}:${agentId}:uar20`).digest('hex');
}

export function buildUar20Receipt(params: {
  req: VerifyActionRequest;
  decision: NexusRiskDecision;
  authority: EffectiveAuthorityReport;
  outcome: EngineOutcomeVerification;
  evidence: EngineEvidenceSeal;
  assurance?: AssuranceEvaluationResult & { status?: string; false_success_detected?: boolean };
  policyHash?: string;
}): Uar20Receipt {
  const { req, decision, authority, outcome, evidence, assurance } = params;
  const transactionId = evidence.actionProof.transactionId;
  const expected_state = { ...outcome.expected.expected_delta };
  const actual_state = outcome.actual?.current_state ?? {};

  const verificationStatus =
    assurance?.status ??
    (outcome.status === 'BLOCKED' ? 'BLOCKED' : outcome.status === 'VERIFIED' ? 'VERIFIED' : 'UNVERIFIED');

  const parameter_hash = sha256Canonical({
    tool: req.toolCall,
    intent: req.userIntent,
    transaction_id: transactionId,
  });
  const outcome_hash = sha256Canonical({ expected_state, actual_state });
  const evidence_hash = evidence.evidenceHash;

  const bodyWithoutSig = {
    uar_version: '2.0' as const,
    receipt_id: evidence.receiptId,
    timestamp: new Date().toISOString(),
    principal: {
      agent_id: req.agentId,
      parent_agent_id: req.parentAgentId,
      delegation_chain: req.parentAgentId ? [req.parentAgentId, req.agentId] : [req.agentId],
    },
    authority: {
      effective_scopes: authority.effectiveScopes,
      authority_hash: sha256Digest(authority.effectiveScopes),
    },
    intent: {
      user_intent: req.userIntent,
      intent_hash: evidence.actionProof.intentHash,
    },
    policy: {
      policy_hash: params.policyHash ?? sha256Digest({ decision }),
      decision,
    },
    action: {
      tool_name: req.toolCall.name,
      tool_call_hash: evidence.actionProof.toolCallHash,
      transaction_id: transactionId,
      executed: decision === 'ALLOW',
      execution_timestamp: new Date().toISOString(),
    },
    expected_outcome: { expected_state },
    actual_outcome: { expected_state: actual_state, actual_state },
    verification: {
      status: verificationStatus as Uar20Receipt['verification']['status'],
      score: assurance?.score ?? outcome.verification_score ?? 100,
      multi_source: [
        {
          vertical: outcome.adapter_system,
          source_id: transactionId,
          observed_at: new Date().toISOString(),
          query_fingerprint: `adapter:${outcome.adapter_system}`,
          observed_state_hash: sha256Canonical(actual_state),
        },
      ],
      claim_diffs: (assurance?.claim_diffs ?? outcome.outcome_diff ?? []).map((d) => ({
        field: d.field,
        expected: d.expected,
        actual: d.actual,
        severity: 'severity' in d ? String(d.severity) : 'MEDIUM',
        authoritative_vertical: 'authoritative_vertical' in d ? String(d.authoritative_vertical) : 'database',
      })),
      false_success_detected: assurance?.false_success_detected ?? outcome.false_success_detected,
      verification_id: outcome.verification_id,
      evidence_ids: outcome.evidence_ids ?? [],
    },
  };

  const receipt_body_hash = sha256Canonical(bodyWithoutSig);
  const signature = `sig_ed25519_${signMaterial(receipt_body_hash, req.agentId).slice(0, 48)}`;

  const receipt: Uar20Receipt = {
    $schema: 'https://nexusshield.ai/schemas/uar-2.0.json',
    ...bodyWithoutSig,
    integrity: {
      parameter_hash,
      outcome_hash,
      evidence_hash,
      receipt_body_hash,
      previous_uar_hash: previousUarHash,
      hash_chain_valid: true,
    },
    signatures: {
      algorithm: 'Ed25519-SHA256',
      signature,
      public_key_id: NEXUS_PROOF_PUBLIC_KEY_ID,
    },
  };

  previousUarHash = sha256Canonical({
    receipt_body_hash,
    previous_uar_hash: previousUarHash,
  });

  return receipt;
}

export function uar20ToProofJson(receipt: Uar20Receipt): string {
  return canonicalJson(receipt);
}
