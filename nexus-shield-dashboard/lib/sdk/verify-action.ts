import { runSevenEnginePipeline, type VerifyActionRequest } from '@/lib/nexus-core/pipeline';

export class SecurityException extends Error {
  readonly decision: string;
  readonly reason: string;
  readonly riskScore: number;

  constructor(message: string, decision: string, reason: string, riskScore: number) {
    super(message);
    this.name = 'SecurityException';
    this.decision = decision;
    this.reason = reason;
    this.riskScore = riskScore;
  }
}

export interface VerifyActionDecision {
  block: boolean;
  allow: boolean;
  requireApproval: boolean;
  reason: string;
  decision: 'BLOCK' | 'ALLOW' | 'REQUIRE_APPROVAL';
  riskScore: number;
  intentDivergencePercent: number;
  actionProofHash: string;
  receiptId: string;
  raw: ReturnType<typeof runSevenEnginePipeline>;
}

export interface VerifyActionParams {
  agent: string;
  intent: string;
  action: { name: string; args?: Record<string, unknown> };
  authority: string[];
  policyYaml?: string;
  transactionId?: string;
  stateBefore?: Record<string, unknown>;
  stateAfter?: Record<string, unknown>;
  apiResult?: { status_code: number; body: string };
}

/**
 * Node/TypeScript SDK entry — mirrors Python `verify_action`.
 * Throws SecurityException when decision is BLOCK.
 */
export function verifyAction(params: VerifyActionParams): VerifyActionDecision {
  const req: VerifyActionRequest = {
    agentId: params.agent,
    userIntent: params.intent,
    toolCall: { name: params.action.name, args: params.action.args ?? {} },
    authority: params.authority,
    policyYaml: params.policyYaml,
    transactionId: params.transactionId,
    stateBefore: params.stateBefore,
    stateAfter: params.stateAfter,
    apiResult: params.apiResult,
  };

  const raw = runSevenEnginePipeline(req);
  const reason =
    raw.violations[0] ??
    (raw.decision === 'REQUIRE_APPROVAL' ? 'Human approval required by policy or risk engine' : 'OK');

  const result: VerifyActionDecision = {
    block: raw.decision === 'BLOCK',
    allow: raw.decision === 'ALLOW',
    requireApproval: raw.decision === 'REQUIRE_APPROVAL',
    reason,
    decision: raw.decision,
    riskScore: raw.firewall.riskScore,
    intentDivergencePercent: raw.actionVerification.mismatchPercent,
    actionProofHash: raw.evidence.actionProof.actionProofHash,
    receiptId: raw.evidence.receiptId,
    raw,
  };

  if (result.block) {
    throw new SecurityException(
      `Action blocked: ${reason}`,
      result.decision,
      reason,
      result.riskScore,
    );
  }

  return result;
}
