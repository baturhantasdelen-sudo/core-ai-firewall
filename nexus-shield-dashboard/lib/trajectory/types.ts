/**
 * P0 Sprint 5-6 — Agent Trajectory Engine types.
 */

export type TrajectoryStepCategory =
  | 'READ_INVOICE'
  | 'READ_CUSTOMER_DB'
  | 'GET_CREDENTIALS'
  | 'EXTERNAL_API'
  | 'READ_DB'
  | 'WRITE_FILE'
  | 'WRITE_DB'
  | 'EXPORT'
  | 'FINANCIAL'
  | 'EXECUTE'
  | 'GENERIC';

export interface TrajectoryStep {
  id: string;
  toolName: string;
  category: TrajectoryStepCategory;
  timestamp: string;
  args?: Record<string, unknown>;
  /** Normalized slot in action vector [A_1..A_n] */
  index: number;
}

export interface TrajectoryChain {
  agentId: string;
  agentName?: string;
  steps: TrajectoryStep[];
  windowStartedAt: string;
  windowEndsAt: string;
}

export interface TrajectoryRiskScore {
  /** 0.0 – 1.0 normalized trajectory risk */
  score: number;
  level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  sequenceViolationDetected: boolean;
  matchedPattern?: string;
  reason: string;
  anomalousSteps: string[];
}

export interface TrajectoryEvaluation {
  chain: TrajectoryChain;
  risk: TrajectoryRiskScore;
  actionVector: TrajectoryStepCategory[];
}

export const TRAJECTORY_HIGH_RISK_THRESHOLD = 0.85;

export function resolveTrajectoryLevel(score: number): TrajectoryRiskScore['level'] {
  if (score >= 0.85) return 'CRITICAL';
  if (score >= 0.65) return 'HIGH';
  if (score >= 0.4) return 'MEDIUM';
  return 'LOW';
}
