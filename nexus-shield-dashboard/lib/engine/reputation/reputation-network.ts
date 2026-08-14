import { getEvidenceVerificationRatio } from '@/lib/engine/evidence/evidence-chain';
import { getMemoryIntegrityScore } from '@/lib/engine/memory/memory-guard';

export type IncidentSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type RiskBadge = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type DelegationRecommendation = 'ALLOW_DELEGATION' | 'REQUIRE_HUMAN_APPROVAL' | 'DENY_DELEGATION';

export interface AgentIncident {
  id: string;
  agentId: string;
  type: string;
  severity: IncidentSeverity;
  timestamp: string;
  resolved: boolean;
}

export interface AgentReputationRecord {
  agentId: string;
  score: number;
  successfulActions: number;
  violations: number;
  blockedViolations: number;
  incidents: AgentIncident[];
  lastUpdated: string;
}

export interface ReputationMetrics {
  successRate: number;
  blockedViolations: number;
  evidenceVerificationRatio: number;
  memoryIntegrityScore: number;
}

export interface AgentReputationCard {
  agentId: string;
  reputationScore: number;
  riskBadge: RiskBadge;
  metrics: ReputationMetrics;
  successfulActions: number;
  violations: number;
  incidents: AgentIncident[];
  lastUpdated: string;
}

export interface InterAgentTrustResult {
  sourceAgentId: string;
  targetAgentId: string;
  trusted: boolean;
  trustScore: number;
  targetReputation: number;
  recommendation: DelegationRecommendation;
  rationale: string[];
}

export interface InterAgentDelegationFlow {
  id: string;
  sourceAgentId: string;
  targetAgentId: string;
  recommendation: DelegationRecommendation;
  trustScore: number;
  timestamp: string;
}

const reputationStore = new Map<string, AgentReputationRecord>();
const delegationFlowStore: InterAgentDelegationFlow[] = [];

const SEED_REPUTATIONS: AgentReputationRecord[] = [
  {
    agentId: 'langchain-support-agent-1',
    score: 82,
    successfulActions: 1240,
    violations: 3,
    blockedViolations: 1,
    incidents: [
      {
        id: 'inc-001',
        agentId: 'langchain-support-agent-1',
        type: 'LOW_INTENT_MISMATCH',
        severity: 'LOW',
        timestamp: '2026-08-10T09:00:00.000Z',
        resolved: true,
      },
    ],
    lastUpdated: '2026-08-14T18:00:00.000Z',
  },
  {
    agentId: 'crewai-ops-agent-1',
    score: 41,
    successfulActions: 890,
    violations: 17,
    blockedViolations: 9,
    incidents: [
      {
        id: 'inc-002',
        agentId: 'crewai-ops-agent-1',
        type: 'PRIVILEGE_ESCALATION',
        severity: 'CRITICAL',
        timestamp: '2026-08-13T14:20:00.000Z',
        resolved: false,
      },
      {
        id: 'inc-003',
        agentId: 'crewai-ops-agent-1',
        type: 'TOOL_CHAIN_ESCALATION',
        severity: 'HIGH',
        timestamp: '2026-08-14T11:05:00.000Z',
        resolved: false,
      },
    ],
    lastUpdated: '2026-08-14T18:00:00.000Z',
  },
  {
    agentId: 'openai-assistant-1',
    score: 76,
    successfulActions: 560,
    violations: 5,
    blockedViolations: 2,
    incidents: [],
    lastUpdated: '2026-08-14T18:00:00.000Z',
  },
];

let seeded = false;

function ensureSeeded(): void {
  if (seeded) return;
  for (const record of SEED_REPUTATIONS) {
    reputationStore.set(record.agentId, record);
  }
  seeded = true;
}

function severityPenalty(severity: IncidentSeverity): number {
  switch (severity) {
    case 'CRITICAL':
      return 25;
    case 'HIGH':
      return 15;
    case 'MEDIUM':
      return 8;
    default:
      return 3;
  }
}

function resolveRiskBadge(score: number): RiskBadge {
  if (score >= 80) return 'LOW';
  if (score >= 60) return 'MEDIUM';
  if (score >= 40) return 'HIGH';
  return 'CRITICAL';
}

export function calculateLiveReputationScore(params: {
  agentId: string;
  successfulActions: number;
  violations: number;
  blockedViolations: number;
  incidents: AgentIncident[];
  evidenceVerificationRatio?: number;
  memoryIntegrityScore?: number;
}): number {
  const totalActions = params.successfulActions + params.violations;
  const successRate = totalActions > 0 ? params.successfulActions / totalActions : 1;
  const evidenceRatio = (params.evidenceVerificationRatio ?? 100) / 100;
  const memoryScore = (params.memoryIntegrityScore ?? 100) / 100;

  let score = Math.round(
    successRate * 35 +
      (1 - Math.min(1, params.blockedViolations / 20)) * 25 +
      evidenceRatio * 20 +
      memoryScore * 20,
  );

  for (const incident of params.incidents) {
    if (!incident.resolved) {
      score -= severityPenalty(incident.severity);
    } else {
      score -= Math.floor(severityPenalty(incident.severity) / 2);
    }
  }

  score -= Math.min(15, params.violations);

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function calculateReputationScore(params: {
  agentId: string;
  successfulActions: number;
  violations: number;
  incidents: AgentIncident[];
}): number {
  ensureSeeded();
  const record = reputationStore.get(params.agentId);
  return calculateLiveReputationScore({
    agentId: params.agentId,
    successfulActions: params.successfulActions,
    violations: params.violations,
    blockedViolations: record?.blockedViolations ?? Math.floor(params.violations / 2),
    incidents: params.incidents,
    evidenceVerificationRatio: getEvidenceVerificationRatio(params.agentId),
    memoryIntegrityScore: getMemoryIntegrityScore(params.agentId),
  });
}

export function getAgentReputation(agentId: string): AgentReputationRecord | undefined {
  ensureSeeded();
  return reputationStore.get(agentId);
}

export function getAgentReputationCard(agentId: string): AgentReputationCard | undefined {
  ensureSeeded();
  const record = reputationStore.get(agentId);
  if (!record) return undefined;

  const totalActions = record.successfulActions + record.violations;
  const successRate = totalActions > 0 ? Math.round((record.successfulActions / totalActions) * 100) : 100;
  const evidenceVerificationRatio = getEvidenceVerificationRatio(agentId);
  const memoryIntegrityScore = getMemoryIntegrityScore(agentId);

  const reputationScore = calculateLiveReputationScore({
    agentId,
    successfulActions: record.successfulActions,
    violations: record.violations,
    blockedViolations: record.blockedViolations,
    incidents: record.incidents,
    evidenceVerificationRatio,
    memoryIntegrityScore,
  });

  return {
    agentId,
    reputationScore,
    riskBadge: resolveRiskBadge(reputationScore),
    metrics: {
      successRate,
      blockedViolations: record.blockedViolations,
      evidenceVerificationRatio,
      memoryIntegrityScore,
    },
    successfulActions: record.successfulActions,
    violations: record.violations,
    incidents: record.incidents,
    lastUpdated: record.lastUpdated,
  };
}

export function upsertAgentReputation(record: AgentReputationRecord): AgentReputationRecord {
  ensureSeeded();
  const score = calculateLiveReputationScore({
    agentId: record.agentId,
    successfulActions: record.successfulActions,
    violations: record.violations,
    blockedViolations: record.blockedViolations,
    incidents: record.incidents,
    evidenceVerificationRatio: getEvidenceVerificationRatio(record.agentId),
    memoryIntegrityScore: getMemoryIntegrityScore(record.agentId),
  });
  const updated = { ...record, score, lastUpdated: new Date().toISOString() };
  reputationStore.set(record.agentId, updated);
  return updated;
}

export function recordAgentIncident(incident: AgentIncident): AgentReputationRecord {
  ensureSeeded();
  const existing =
    reputationStore.get(incident.agentId) ??
    ({
      agentId: incident.agentId,
      score: 70,
      successfulActions: 0,
      violations: 0,
      blockedViolations: 0,
      incidents: [],
      lastUpdated: new Date().toISOString(),
    } satisfies AgentReputationRecord);

  const incidents = [...existing.incidents, incident];
  const violations = existing.violations + 1;
  const blockedViolations =
    incident.severity === 'HIGH' || incident.severity === 'CRITICAL'
      ? existing.blockedViolations + 1
      : existing.blockedViolations;

  const score = calculateLiveReputationScore({
    agentId: incident.agentId,
    successfulActions: existing.successfulActions,
    violations,
    blockedViolations,
    incidents,
    evidenceVerificationRatio: getEvidenceVerificationRatio(incident.agentId),
    memoryIntegrityScore: getMemoryIntegrityScore(incident.agentId),
  });

  const updated: AgentReputationRecord = {
    ...existing,
    score,
    violations,
    blockedViolations,
    incidents,
    lastUpdated: new Date().toISOString(),
  };

  reputationStore.set(incident.agentId, updated);
  return updated;
}

export function verifyInterAgentTrust(
  sourceAgentId: string,
  targetAgentId: string,
): InterAgentTrustResult {
  ensureSeeded();

  const source = reputationStore.get(sourceAgentId);
  const target = reputationStore.get(targetAgentId);
  const targetCard = getAgentReputationCard(targetAgentId);
  const targetReputation = targetCard?.reputationScore ?? target?.score ?? 50;
  const sourceReputation = source?.score ?? 50;

  const unresolvedCritical =
    target?.incidents.filter((incident) => !incident.resolved && incident.severity === 'CRITICAL')
      .length ?? 0;

  let trustScore = Math.round(
    targetReputation * 0.45 +
      sourceReputation * 0.15 +
      (targetCard?.metrics.memoryIntegrityScore ?? 100) * 0.2 +
      (targetCard?.metrics.evidenceVerificationRatio ?? 100) * 0.2,
  );

  const rationale: string[] = [];

  if (unresolvedCritical > 0) {
    trustScore -= 30;
    rationale.push('Target agent has unresolved CRITICAL incidents');
  }

  if ((target?.blockedViolations ?? 0) > 5) {
    trustScore -= 15;
    rationale.push('Target agent blocked violation count exceeds safe delegation threshold');
  }

  if ((targetCard?.metrics.memoryIntegrityScore ?? 100) < 60) {
    trustScore -= 20;
    rationale.push('Target agent memory integrity score below safe threshold');
  }

  if ((targetCard?.metrics.evidenceVerificationRatio ?? 100) < 50) {
    trustScore -= 10;
    rationale.push('Target agent evidence verification ratio is low');
  }

  trustScore = Math.max(0, Math.min(100, trustScore));

  let recommendation: DelegationRecommendation = 'ALLOW_DELEGATION';
  if (trustScore < 40 || targetReputation < 40) recommendation = 'DENY_DELEGATION';
  else if (trustScore < 70) recommendation = 'REQUIRE_HUMAN_APPROVAL';

  if (rationale.length === 0) {
    rationale.push(`Target reputation ${targetReputation}/100 with stable incident history`);
  }

  const result: InterAgentTrustResult = {
    sourceAgentId,
    targetAgentId,
    trusted: trustScore >= 70 && recommendation === 'ALLOW_DELEGATION',
    trustScore,
    targetReputation,
    recommendation,
    rationale,
  };

  delegationFlowStore.unshift({
    id: `deleg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    sourceAgentId,
    targetAgentId,
    recommendation,
    trustScore,
    timestamp: new Date().toISOString(),
  });
  if (delegationFlowStore.length > 50) delegationFlowStore.pop();

  return result;
}

export function listAgentReputations(): AgentReputationRecord[] {
  ensureSeeded();
  return [...reputationStore.values()].sort((a, b) => b.score - a.score);
}

export function listAgentReputationCards(): AgentReputationCard[] {
  ensureSeeded();
  return listAgentReputations()
    .map((record) => getAgentReputationCard(record.agentId))
    .filter((card): card is AgentReputationCard => card !== undefined);
}

export function listInterAgentDelegationFlows(limit = 10): InterAgentDelegationFlow[] {
  return delegationFlowStore.slice(0, limit);
}

export function resetReputationStore(): void {
  reputationStore.clear();
  delegationFlowStore.length = 0;
  seeded = false;
}
