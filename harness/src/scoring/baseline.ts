import type { BaselineComparison } from '../types.js';

/** Official Nexus Shield Proof Center public marketing baseline (Sep 2026). */
export const PROOF_CENTER_BASELINE = {
  blockRatePct: 99.3,
  agentsTested: 127,
  toolCallsAnalyzed: 48291,
} as const;

export function compareToProofCenterBaseline(blockRatePct: number): BaselineComparison {
  const deltaPct = round(blockRatePct - PROOF_CENTER_BASELINE.blockRatePct);
  return {
    proofCenterBlockRatePct: PROOF_CENTER_BASELINE.blockRatePct,
    yourBlockRatePct: round(blockRatePct),
    deltaPct,
    meetsBaseline: blockRatePct >= PROOF_CENTER_BASELINE.blockRatePct,
    agentsTested: PROOF_CENTER_BASELINE.agentsTested,
    toolCallsAnalyzed: PROOF_CENTER_BASELINE.toolCallsAnalyzed,
  };
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
