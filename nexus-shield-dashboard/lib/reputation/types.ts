/**
 * P2 Sprint 17-18 — Agent Reputation Scorecard & Dynamic Trust types.
 */

export type TrustTier = 'VERIFIED' | 'NEUTRAL' | 'HIGH_RISK' | 'UNTRUSTED';

export type TrustPolicyAction =
  | 'ALLOW_ALL'
  | 'ENHANCED_MONITORING'
  | 'RESTRICT_SENSITIVE_OPS'
  | 'REQUIRE_HUMAN_APPROVAL'
  | 'FREEZE_AGENT';

export interface ReputationMetrics {
  totalActions: number;
  blockedActions: number;
  evidenceVerificationRate: number;
  resilienceScore: number;
  memoryPoisonIncidents: number;
}

export interface AgentReputation {
  agentId: string;
  agentName?: string;
  reputationScore: number;
  trustTier: TrustTier;
  metrics: ReputationMetrics;
  trend: 'IMPROVING' | 'STABLE' | 'DECLINING';
  calculatedAt: string;
  rationale: string[];
}

export interface ReputationCalculationInput {
  agentId: string;
  agentName?: string;
  metrics: ReputationMetrics;
  previousScore?: number;
}

export interface TrustPolicyResult {
  agentId: string;
  trustTier: TrustTier;
  action: TrustPolicyAction;
  restrictions: string[];
  message: string;
}

export function resolveTrustTier(score: number): TrustTier {
  if (score >= 85) return 'VERIFIED';
  if (score >= 60) return 'NEUTRAL';
  if (score >= 35) return 'HIGH_RISK';
  return 'UNTRUSTED';
}
