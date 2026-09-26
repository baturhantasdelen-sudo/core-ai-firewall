import { createHash, randomUUID } from 'crypto';
import type { ActionEvaluationResult } from '@/lib/engine/action-firewall';
import type { UniversalActionDecision, UniversalActionReceipt } from '@/types/action-receipt';

export type AdaptivePolicyDecision = UniversalActionDecision;

export interface AgentPolicyEvaluationInput {
  agentId: string;
  userIntent: string;
  toolName: string;
  toolArgs: Record<string, unknown>;
  identityVerified?: boolean;
}

export interface AgentPolicyEvaluationResult {
  decision: AdaptivePolicyDecision;
  rule_id: string;
  policy_action: string;
  risk_score: number;
  violations: string[];
  receipt: UniversalActionReceipt;
}

function sha256(payload: string): string {
  return createHash('sha256').update(payload).digest('hex');
}

/** Map runtime firewall output to adaptive degradation states (non-binary governance). */
export function mapEvaluationToGovernanceDecision(
  result: ActionEvaluationResult,
): AdaptivePolicyDecision {
  if (result.agentStatus === 'READ_ONLY' && result.decision !== 'BLOCK') {
    return 'READ_ONLY';
  }
  if (result.decision === 'HUMAN_APPROVAL_REQUIRED') {
    return 'REQUIRE_APPROVAL';
  }
  if (result.decision === 'BLOCK') {
    if (result.capabilitiesRevoked || result.agentStatus === 'READ_ONLY') {
      return 'READ_ONLY';
    }
    return 'BLOCK';
  }
  return 'ALLOW';
}

function resolveRuleId(result: ActionEvaluationResult): string {
  if (result.killSwitchTriggered) return 'POLICY_KILL_SWITCH';
  if (result.capabilitiesRevoked) return 'POLICY_CAPABILITY_REVOCATION';
  if ((result.intentDivergencePercent ?? 0) >= 70) return 'POLICY_INTENT_DIVERGENCE';
  if (result.violations.some((v) => /Capability|Agent lacks/.test(v))) return 'POLICY_EXCESSIVE_AGENCY';
  return 'POLICY_BASELINE_ALLOW';
}

export function buildUniversalActionReceipt(
  input: AgentPolicyEvaluationInput,
  result: ActionEvaluationResult,
): UniversalActionReceipt {
  const decision = mapEvaluationToGovernanceDecision(result);
  const ruleId = resolveRuleId(result);
  const timestamp = new Date().toISOString();
  const before_hash = sha256(JSON.stringify({ intent: input.userIntent, agent: input.agentId }));
  const after_hash =
    decision === 'ALLOW'
      ? sha256(JSON.stringify({ intent: input.userIntent, tool: input.toolName, args: input.toolArgs }))
      : sha256(`UNVERIFIED:${decision}:${input.toolName}`);

  const receiptCore = {
    receipt_id: `uar_${randomUUID()}`,
    timestamp,
    agent: { id: input.agentId, identity_verified: input.identityVerified ?? true },
    intent: input.userIntent,
    proposed_action: { tool: input.toolName, params: input.toolArgs },
    policy_evaluated: { rule_id: ruleId, action: decision },
    decision,
    execution_state: { before_hash, after_hash },
  };

  const evidence_bundle_hash = sha256(JSON.stringify(receiptCore));

  return { ...receiptCore, evidence_bundle_hash };
}

export function evaluateAdaptivePolicy(
  input: AgentPolicyEvaluationInput,
  firewallResult: ActionEvaluationResult,
): AgentPolicyEvaluationResult {
  const decision = mapEvaluationToGovernanceDecision(firewallResult);
  const rule_id = resolveRuleId(firewallResult);
  const receipt = buildUniversalActionReceipt(input, firewallResult);

  return {
    decision,
    rule_id,
    policy_action: decision,
    risk_score: firewallResult.riskScore,
    violations: firewallResult.violations,
    receipt,
  };
}
