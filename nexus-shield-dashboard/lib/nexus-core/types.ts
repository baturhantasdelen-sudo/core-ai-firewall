import type { ActionProofBundle } from '@/lib/accountability/action-proof';
import type { EnterpriseAgentPolicy } from '@/lib/policy-as-code/types';
import type { ActionEvaluationResult, ToolCallInput } from '@/lib/engine/action-firewall';
import type { EffectiveAuthorityReport } from '@/lib/engine/agents/effective-authority';
import type { AgentAsset } from '@/lib/engine/discovery';
import type { OutcomeVerificationResult } from '@/lib/engine/evidence/evidential-verifier';
import type { IntentDivergenceReport } from '@/lib/engine/action-firewall/intent-divergence';

export type NexusRiskDecision = 'BLOCK' | 'ALLOW' | 'REQUIRE_APPROVAL';

export interface VerifyActionRequest {
  agentId: string;
  userIntent: string;
  toolCall: ToolCallInput;
  /** Declared capability scopes (authority boundary). */
  authority: string[];
  policy?: EnterpriseAgentPolicy;
  policyYaml?: string;
  workGraphNodeId?: string;
  transactionId?: string;
  evidenceBundle?: {
    transactionId?: string;
    bankApiResponse?: string;
    databaseRecordHash?: string;
    executionLog?: string;
    authorizedAgentSignature?: string;
  };
  stateBefore?: Record<string, unknown>;
  stateAfter?: Record<string, unknown>;
  apiResult?: { status_code: number; body: string };
  mcpTools?: string[];
}

export interface EngineDiscoverySnapshot {
  agentId: string;
  cataloged: boolean;
  scopes: string[];
  mcpTools: string[];
  framework: string;
}

export interface EngineActionVerification {
  intentMatchScore: number;
  divergenceScore: number;
  mismatchPercent: number;
  report: IntentDivergenceReport;
}

export interface EngineTransactionVerification {
  outcome: OutcomeVerificationResult;
  ghostActionSuspected: boolean;
  falseSuccessSuspected: boolean;
  stateDeltaVerified: boolean;
}

export interface EngineEvidenceSeal {
  actionProof: ActionProofBundle;
  evidenceHash: string;
  signature: string;
  receiptId: string;
}

export interface SevenEnginePipelineResult {
  decision: NexusRiskDecision;
  firewall: ActionEvaluationResult;
  discovery: EngineDiscoverySnapshot;
  authority: EffectiveAuthorityReport;
  actionVerification: EngineActionVerification;
  transactionVerification: EngineTransactionVerification;
  policyEvaluation?: {
    allowed: boolean;
    requiresApproval: boolean;
    reason?: string;
  };
  evidence: EngineEvidenceSeal;
  violations: string[];
  capabilitiesRevoked: boolean;
  latencyMs: number;
}
