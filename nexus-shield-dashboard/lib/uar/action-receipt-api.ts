import type { UniversalActionDecision } from '@/types/action-receipt';

export type Authorization = 'approved' | 'blocked' | 'read_only' | 'approval_required';
export type PolicyResult = 'passed' | 'failed';
export type ExecutionResult = 'success' | 'failure' | 'blocked' | 'pending';

export interface ActionReceiptAPI {
  action_id: string;
  agent_id: string;
  intent: string;
  tool: { name: string; params: Record<string, unknown> };
  authorization: Authorization;
  policy: PolicyResult;
  execution: ExecutionResult;
  before_state_hash: string;
  after_state_hash: string;
  evidence_hash: string;
  timestamp: string;
  signature: string;
}

export function decisionToAuthorization(decision: string): Authorization {
  const map: Record<string, Authorization> = {
    ALLOW: 'approved',
    BLOCK: 'blocked',
    READ_ONLY: 'read_only',
    REQUIRE_APPROVAL: 'approval_required',
    HUMAN_APPROVAL_REQUIRED: 'approval_required',
  };
  return map[decision.toUpperCase()] ?? 'blocked';
}

export function toActionReceiptAPI(input: {
  agentId: string;
  intent: string;
  toolName: string;
  toolParams: Record<string, unknown>;
  decision: UniversalActionDecision | string;
  receiptId: string;
  timestamp: string;
  beforeHash: string;
  afterHash: string;
  evidenceHash: string;
  ruleId?: string;
}): ActionReceiptAPI {
  const authorization = decisionToAuthorization(input.decision);
  const policy: PolicyResult =
    authorization === 'approved' || authorization === 'read_only' ? 'passed' : 'failed';
  let execution: ExecutionResult = 'pending';
  if (authorization === 'blocked') execution = 'blocked';
  else if (authorization === 'approved') execution = 'success';
  else if (authorization === 'read_only') execution = 'failure';

  return {
    action_id: input.receiptId,
    agent_id: input.agentId,
    intent: input.intent,
    tool: { name: input.toolName, params: input.toolParams },
    authorization,
    policy,
    execution,
    before_state_hash: input.beforeHash,
    after_state_hash: input.afterHash,
    evidence_hash: input.evidenceHash,
    timestamp: input.timestamp,
    signature: input.evidenceHash,
  };
}
