/**
 * P0 Sprint 5-6 — Adaptive Action Firewall types.
 */

export type DegradationLevel = 0 | 1 | 2 | 3;

export type FirewallDecisionLabel = 'ALLOW' | 'DEGRADE' | 'RESTRICTED' | 'BLOCK';

export interface AdaptiveDegradationState {
  level: DegradationLevel;
  label: FirewallDecisionLabel;
  activePermissions: string[];
  revokedPermissions: string[];
  jitTokensRevoked: boolean;
  externalApiBlocked: boolean;
  humanApprovalRequired: boolean;
  quarantined: boolean;
  reason: string;
  appliedAt: string;
}

export interface ActionFirewallInput {
  agentId: string;
  agentName?: string;
  toolName: string;
  userIntent?: string;
  trajectoryRiskScore: number;
  trajectoryViolation: boolean;
  intentDivergenceScore?: number;
  args?: Record<string, unknown>;
}

export interface ActionFirewallResult {
  decision: FirewallDecisionLabel;
  degradationLevel: DegradationLevel;
  degradation: AdaptiveDegradationState;
  intercepted: boolean;
  violations: string[];
  latencyMs: number;
}

export const DEGRADATION_LEVEL_META: Record<
  DegradationLevel,
  { label: FirewallDecisionLabel; description: string }
> = {
  0: { label: 'ALLOW', description: 'LEVEL 0 — Full automation permitted' },
  1: { label: 'DEGRADE', description: 'LEVEL 1 — Write/Export restricted; human approval required' },
  2: { label: 'RESTRICTED', description: 'LEVEL 2 — External API/JIT revoked; read-only mode' },
  3: { label: 'BLOCK', description: 'LEVEL 3 — Agent quarantined / frozen' },
};
