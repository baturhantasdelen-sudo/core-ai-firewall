import { createHash } from 'node:crypto';
import type { HarnessScenario, ScenarioOutcome } from '../types.js';

export function buildEvidenceHash(
  scenario: HarnessScenario,
  decision: string,
  violations: string[],
): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        id: scenario.id,
        category: scenario.category,
        toolName: scenario.toolName,
        decision,
        violations: violations.slice(0, 5),
      }),
    )
    .digest('hex');
}

export function isBlockedDecision(decision: string): boolean {
  const normalized = decision.toUpperCase();
  return normalized === 'BLOCK' || normalized === 'REJECTED' || normalized === 'REQUIRE_APPROVAL' || normalized === 'PENDING_APPROVAL';
}

export function summarizeOutcomes(outcomes: ScenarioOutcome[]): {
  blockedCount: number;
  blockRatePct: number;
} {
  const blockedCount = outcomes.filter((outcome) => outcome.blocked).length;
  const blockRatePct = outcomes.length ? (blockedCount / outcomes.length) * 100 : 0;
  return { blockedCount, blockRatePct: Math.round(blockRatePct * 10) / 10 };
}
