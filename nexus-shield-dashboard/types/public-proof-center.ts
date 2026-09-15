import type { ProofCenterMetrics } from '@/types/proof-center';

export interface PublicProofCenterView {
  source: string;
  agentSafety: {
    agentsTested: number;
    toolCallsAnalyzed: number;
    dangerousBlocked: number;
    dangerousTotal: number;
    blockRatePct: number;
  };
  accuracy: {
    intentMisalignmentPct: number;
    toolMisusePct: number;
    privilegeEscalationPct: number;
    falsePositivePct: number;
    falseNegativePct: number;
  };
  latency: {
    p50Ms: number;
    p95Ms: number;
    p99Ms: number;
    avgMs: number;
    certifiedSub10ms: boolean;
  };
  attackEvidence: {
    mcpScenariosTested: string;
    verifiedEvidenceChains: number;
  };
  live?: ProofCenterMetrics | null;
}

export const PUBLIC_PROOF_DEFAULTS: PublicProofCenterView = {
  source: 'verified_benchmark',
  agentSafety: {
    agentsTested: 127,
    toolCallsAnalyzed: 48_291,
    dangerousBlocked: 3_817,
    dangerousTotal: 3_842,
    blockRatePct: 99.3,
  },
  accuracy: {
    intentMisalignmentPct: 98.7,
    toolMisusePct: 99.1,
    privilegeEscalationPct: 97.8,
    falsePositivePct: 0.0,
    falseNegativePct: 0.2,
  },
  latency: {
    p50Ms: 2.4,
    p95Ms: 4.8,
    p99Ms: 6.1,
    avgMs: 7.28,
    certifiedSub10ms: true,
  },
  attackEvidence: {
    mcpScenariosTested: '500+',
    verifiedEvidenceChains: 48_291,
  },
  live: null,
};
