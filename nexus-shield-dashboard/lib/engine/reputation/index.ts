export type IncidentSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

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
  incidents: AgentIncident[];
  lastUpdated: string;
}

export interface InterAgentTrustResult {
  sourceAgentId: string;
  targetAgentId: string;
  trusted: boolean;
  trustScore: number;
  targetReputation: number;
  recommendation: 'ALLOW_DELEGATION' | 'REQUIRE_HUMAN_APPROVAL' | 'DENY_DELEGATION';
  rationale: string[];
}

const reputationStore = new Map<string, AgentReputationRecord>();

const SEED_REPUTATIONS: AgentReputationRecord[] = [
  {
    agentId: 'langchain-support-agent-1',
    score: 82,
    successfulActions: 1240,
    violations: 3,
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

export function calculateReputationScore(params: {
  agentId: string;
  successfulActions: number;
  violations: number;
  incidents: AgentIncident[];
}): number {
  let score = 70;

  score += Math.min(20, Math.floor(params.successfulActions / 100));
  score -= Math.min(30, params.violations * 2);

  for (const incident of params.incidents) {
    if (!incident.resolved) {
      score -= severityPenalty(incident.severity);
    } else {
      score -= Math.floor(severityPenalty(incident.severity) / 2);
    }
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function getAgentReputation(agentId: string): AgentReputationRecord | undefined {
  ensureSeeded();
  return reputationStore.get(agentId);
}

export function upsertAgentReputation(record: AgentReputationRecord): AgentReputationRecord {
  ensureSeeded();
  reputationStore.set(record.agentId, record);
  return record;
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
      incidents: [],
      lastUpdated: new Date().toISOString(),
    } satisfies AgentReputationRecord);

  const incidents = [...existing.incidents, incident];
  const violations = existing.violations + 1;
  const score = calculateReputationScore({
    agentId: incident.agentId,
    successfulActions: existing.successfulActions,
    violations,
    incidents,
  });

  const updated: AgentReputationRecord = {
    ...existing,
    score,
    violations,
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
  const targetReputation = target?.score ?? 50;
  const sourceReputation = source?.score ?? 50;

  const unresolvedCritical =
    target?.incidents.filter((incident) => !incident.resolved && incident.severity === 'CRITICAL')
      .length ?? 0;

  let trustScore = Math.round((targetReputation * 0.7 + sourceReputation * 0.3));
  const rationale: string[] = [];

  if (unresolvedCritical > 0) {
    trustScore -= 30;
    rationale.push('Target agent has unresolved CRITICAL incidents');
  }

  if ((target?.violations ?? 0) > 10) {
    trustScore -= 15;
    rationale.push('Target agent violation count exceeds safe delegation threshold');
  }

  trustScore = Math.max(0, Math.min(100, trustScore));

  let recommendation: InterAgentTrustResult['recommendation'] = 'ALLOW_DELEGATION';
  if (trustScore < 40) recommendation = 'DENY_DELEGATION';
  else if (trustScore < 70) recommendation = 'REQUIRE_HUMAN_APPROVAL';

  if (rationale.length === 0) {
    rationale.push(`Target reputation ${targetReputation}/100 with stable incident history`);
  }

  return {
    sourceAgentId,
    targetAgentId,
    trusted: trustScore >= 70,
    trustScore,
    targetReputation,
    recommendation,
    rationale,
  };
}

export function listAgentReputations(): AgentReputationRecord[] {
  ensureSeeded();
  return [...reputationStore.values()].sort((a, b) => b.score - a.score);
}

export function resetReputationStore(): void {
  reputationStore.clear();
  seeded = false;
}
