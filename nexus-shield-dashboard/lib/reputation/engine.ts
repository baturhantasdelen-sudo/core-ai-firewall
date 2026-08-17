import {
  resolveTrustTier,
  type AgentReputation,
  type ReputationCalculationInput,
  type ReputationMetrics,
  type TrustPolicyAction,
  type TrustPolicyResult,
  type TrustTier,
} from '@/lib/reputation/types';

const reputationStore = new Map<string, AgentReputation>();
const metricsStore = new Map<string, ReputationMetrics>();
const previousScoreStore = new Map<string, number>();

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function resolveTrend(current: number, previous?: number): AgentReputation['trend'] {
  if (previous === undefined) return 'STABLE';
  if (current > previous + 3) return 'IMPROVING';
  if (current < previous - 3) return 'DECLINING';
  return 'STABLE';
}

/**
 * Blends P0 trajectory/firewall, P1 evidence, P2 memory & red team signals
 * into a dynamic agent reputation score.
 */
export function calculateAgentReputation(input: ReputationCalculationInput): AgentReputation {
  const { metrics } = input;
  const rationale: string[] = [];
  let score = 55;

  score += (metrics.evidenceVerificationRate / 100) * 20;
  rationale.push(`+evidence verification (${metrics.evidenceVerificationRate}%)`);

  score += (metrics.resilienceScore / 100) * 25;
  rationale.push(`+red team resilience (${metrics.resilienceScore}/100)`);

  if (metrics.totalActions > 0) {
    const violationRate = metrics.blockedActions / metrics.totalActions;
    const penalty = Math.round(violationRate * 35);
    score -= penalty;
    rationale.push(`-violation attempt rate (${Math.round(violationRate * 100)}%)`);
  }

  const poisonPenalty = metrics.memoryPoisonIncidents * 12;
  if (poisonPenalty > 0) {
    score -= poisonPenalty;
    rationale.push(`-memory poison incidents (${metrics.memoryPoisonIncidents})`);
  }

  if (metrics.evidenceVerificationRate >= 90 && metrics.resilienceScore >= 85) {
    score += 5;
    rationale.push('+strong cross-layer trust signals');
  }

  score = clampScore(score);
  const previousScore = input.previousScore ?? previousScoreStore.get(input.agentId);
  const trustTier = resolveTrustTier(score);

  const reputation: AgentReputation = {
    agentId: input.agentId,
    agentName: input.agentName,
    reputationScore: score,
    trustTier,
    metrics: { ...metrics },
    trend: resolveTrend(score, previousScore),
    calculatedAt: new Date().toISOString(),
    rationale,
  };

  previousScoreStore.set(input.agentId, score);
  reputationStore.set(input.agentId, reputation);
  metricsStore.set(input.agentId, { ...metrics });

  return reputation;
}

/**
 * Returns restrictive policy action when reputation score drops.
 */
export function getTrustPolicyAction(reputation: AgentReputation): TrustPolicyResult {
  const { trustTier, agentId, reputationScore } = reputation;

  let action: TrustPolicyAction;
  let restrictions: string[] = [];
  let message: string;

  switch (trustTier) {
    case 'VERIFIED':
      action = 'ALLOW_ALL';
      message = 'Agent verified — full capability scope permitted';
      break;
    case 'NEUTRAL':
      action = 'ENHANCED_MONITORING';
      restrictions = ['AUDIT_ALL_WRITE', 'LOG_TOOL_CALLS'];
      message = 'Neutral trust — enhanced monitoring active';
      break;
    case 'HIGH_RISK':
      action = 'RESTRICT_SENSITIVE_OPS';
      restrictions = ['BLOCK_PAYMENT', 'BLOCK_EXPORT', 'REQUIRE_APPROVAL_WRITE'];
      message = 'High risk — sensitive operations restricted';
      break;
    default:
      action = 'FREEZE_AGENT';
      restrictions = ['AGENT_FROZEN', 'DENY_ALL_FINANCIAL', 'DENY_DB_EXPORT'];
      message = 'Untrusted agent — frozen pending security review';
  }

  if (reputationScore < 40) {
    action = 'FREEZE_AGENT';
    restrictions = ['AGENT_FROZEN', 'DENY_ALL_FINANCIAL', 'DENY_DB_EXPORT'];
    message = 'Critical reputation drop — agent frozen immediately';
  } else if (reputationScore < 60 && action === 'ENHANCED_MONITORING') {
    action = 'REQUIRE_HUMAN_APPROVAL';
    restrictions.push('REQUIRE_HUMAN_APPROVAL_ALL');
    message = 'Declining reputation — human approval required for writes';
  }

  return { agentId, trustTier, action, restrictions, message };
}

export function upsertAgentMetrics(agentId: string, metrics: Partial<ReputationMetrics>): ReputationMetrics {
  const current = metricsStore.get(agentId) ?? {
    totalActions: 0,
    blockedActions: 0,
    evidenceVerificationRate: 80,
    resilienceScore: 75,
    memoryPoisonIncidents: 0,
  };

  const merged = { ...current, ...metrics };
  metricsStore.set(agentId, merged);
  return merged;
}

export function simulatePositiveActivity(agentId: string, agentName?: string): AgentReputation {
  const metrics = upsertAgentMetrics(agentId, {
    totalActions: (metricsStore.get(agentId)?.totalActions ?? 100) + 10,
    evidenceVerificationRate: Math.min(100, (metricsStore.get(agentId)?.evidenceVerificationRate ?? 70) + 8),
    resilienceScore: Math.min(100, (metricsStore.get(agentId)?.resilienceScore ?? 70) + 5),
    memoryPoisonIncidents: Math.max(0, (metricsStore.get(agentId)?.memoryPoisonIncidents ?? 1) - 1),
  });

  return calculateAgentReputation({
    agentId,
    agentName,
    metrics,
    previousScore: previousScoreStore.get(agentId),
  });
}

export function simulateSecurityViolation(agentId: string, agentName?: string): AgentReputation {
  const current = metricsStore.get(agentId);
  const metrics = upsertAgentMetrics(agentId, {
    totalActions: (current?.totalActions ?? 50) + 5,
    blockedActions: (current?.blockedActions ?? 5) + 4,
    evidenceVerificationRate: Math.max(0, (current?.evidenceVerificationRate ?? 80) - 20),
    resilienceScore: Math.max(0, (current?.resilienceScore ?? 80) - 25),
    memoryPoisonIncidents: (current?.memoryPoisonIncidents ?? 0) + 2,
  });

  return calculateAgentReputation({
    agentId,
    agentName,
    metrics,
    previousScore: previousScoreStore.get(agentId),
  });
}

export function getAgentReputation(agentId: string): AgentReputation | undefined {
  return reputationStore.get(agentId);
}

export function listAgentReputations(): AgentReputation[] {
  return [...reputationStore.values()].sort((a, b) => b.reputationScore - a.reputationScore);
}

export function resetReputationEngineStore(): void {
  reputationStore.clear();
  metricsStore.clear();
  previousScoreStore.clear();
}

export function buildMockAgentReputations(): AgentReputation[] {
  resetReputationEngineStore();

  const agents: Array<{ id: string; name: string; metrics: ReputationMetrics }> = [
    {
      id: 'langchain-support-agent-1',
      name: 'Support Agent',
      metrics: {
        totalActions: 1240,
        blockedActions: 12,
        evidenceVerificationRate: 94,
        resilienceScore: 92,
        memoryPoisonIncidents: 0,
      },
    },
    {
      id: 'crewai-ops-agent-1',
      name: 'Ops Coordinator',
      metrics: {
        totalActions: 890,
        blockedActions: 78,
        evidenceVerificationRate: 62,
        resilienceScore: 58,
        memoryPoisonIncidents: 2,
      },
    },
    {
      id: 'rogue-shadow-agent-1',
      name: 'Shadow Agent',
      metrics: {
        totalActions: 210,
        blockedActions: 95,
        evidenceVerificationRate: 28,
        resilienceScore: 22,
        memoryPoisonIncidents: 5,
      },
    },
  ];

  return agents.map((agent) =>
    calculateAgentReputation({
      agentId: agent.id,
      agentName: agent.name,
      metrics: agent.metrics,
    }),
  );
}
