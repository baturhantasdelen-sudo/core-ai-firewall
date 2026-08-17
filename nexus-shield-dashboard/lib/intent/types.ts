/**
 * P1 Sprint 9-10 — Intent vs Action Divergence types.
 */

export type DivergenceRisk = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type DivergenceAction =
  | 'ALLOW'
  | 'REVOKE_CAPABILITIES'
  | 'BLOCK_ACTION'
  | 'CRITICAL_BLOCK';

export interface ToolCallStep {
  tool: string;
  args?: Record<string, unknown>;
  timestamp?: string;
}

export interface IntentAnalysisResult {
  userIntent: string;
  toolCalls: ToolCallStep[];
  divergencePercent: number;
  risk: DivergenceRisk;
  intentTags: string[];
  intentMatchScore: number;
  mismatchedSteps: Array<{ tool: string; reason: string }>;
  recommendation: DivergenceAction;
  shouldBlock: boolean;
  violation?: string;
  analyzedAt: string;
}

export const CRITICAL_DIVERGENCE_THRESHOLD = 80;

export function isCriticalDivergence(result: IntentAnalysisResult): boolean {
  return result.risk === 'CRITICAL' || result.divergencePercent >= CRITICAL_DIVERGENCE_THRESHOLD;
}
