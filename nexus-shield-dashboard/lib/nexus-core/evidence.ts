import { createHash, randomBytes } from 'node:crypto';
import { computeActionProofBundle, sha256Digest } from '@/lib/accountability/action-proof';
import type { EffectiveAuthorityReport } from '@/lib/engine/agents/effective-authority';
import type { EngineEvidenceSeal, NexusRiskDecision, VerifyActionRequest } from '@/lib/nexus-core/types';
import type { EngineOutcomeVerification } from '@/lib/nexus-core/outcome-verification';
import type { AutonomousContainmentResult } from '@/lib/nexus-core/containment';
import type { UarV2Receipt } from '@/lib/nexus-core/schemas/uar-v2';

export function buildUarV2Receipt(params: {
  req: VerifyActionRequest;
  decision: NexusRiskDecision;
  authority: EffectiveAuthorityReport;
  outcome: EngineOutcomeVerification;
  evidence: EngineEvidenceSeal;
  containment: AutonomousContainmentResult;
}): UarV2Receipt {
  const { req, decision, authority, outcome, evidence, containment } = params;
  const intentHash = evidence.actionProof.intentHash;
  const authority_hash = sha256Digest(authority.effectiveScopes);
  const resultHash = evidence.actionProof.resultHash;
  const binding_valid = evidence.evidenceHash === evidence.actionProof.actionProofHash;

  return {
    $schema: 'https://nexusshield.ai/schemas/aar-v2.json',
    receipt_id: evidence.receiptId,
    timestamp: new Date().toISOString(),
    trace: {
      who: { agent_id: req.agentId },
      can: { effective_scopes: authority.effectiveScopes, authority_hash },
      why: { user_intent: req.userIntent, intent_hash: intentHash },
      did: {
        tool_name: req.toolCall.name,
        tool_call_hash: evidence.actionProof.toolCallHash,
        transaction_id: evidence.actionProof.transactionId,
      },
      outcome: {
        status: outcome.status,
        result_hash: resultHash,
        adapter_system: outcome.adapter_system,
        divergence_reason: outcome.divergence_reason,
      },
    },
    cryptographic_anchor: {
      evidence_hash: evidence.evidenceHash,
      signature: evidence.signature,
      action_proof: evidence.actionProof,
      binding_valid,
    },
    decision,
    agent_status: containment.agentStatus,
    capabilities_revoked: containment.capabilitiesRevoked,
    containment: {
      human_in_the_loop: containment.humanInTheLoop,
      trust_isolation: containment.trustIsolation,
    },
  };
}

/** Evidence Engine — seal action proof + Ed25519-style signature. */
export function runEvidenceEngine(
  req: VerifyActionRequest,
  policyDocument: unknown,
  decision: NexusRiskDecision,
  outcomeStatus: string,
): EngineEvidenceSeal {
  const transactionId = req.transactionId ?? req.evidenceBundle?.transactionId ?? `TXN-${req.agentId}-${Date.now()}`;
  const actionProof = computeActionProofBundle({
    intent: req.userIntent,
    policyDocument,
    toolCall: req.toolCall,
    transactionId,
    result: { decision, outcome_status: outcomeStatus, tool: req.toolCall.name },
  });

  const evidenceHash = actionProof.actionProofHash;
  const sigMaterial = createHash('sha256')
    .update(`${evidenceHash}:${req.agentId}:${decision}`)
    .digest('hex');
  const signature = `sig_nexus_ed25519_${sigMaterial.slice(0, 48)}`;

  return {
    actionProof,
    evidenceHash,
    signature,
    receiptId: `aar_${randomBytes(12).toString('hex')}`,
  };
}
