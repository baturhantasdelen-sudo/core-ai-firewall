import type { TrajectoryEntry } from '@/lib/engine/action-firewall/trajectory';
import type { AgentReputationCard } from '@/lib/engine/reputation';
import type { EvidenceChainLogEntry } from '@/lib/engine/evidence/evidence-chain';
import type { MemoryQuarantineEntry } from '@/lib/engine/memory/memory-guard';
import type { InterAgentDelegationFlow } from '@/lib/engine/reputation/reputation-network';
import { listAgentReputationCards, listInterAgentDelegationFlows } from '@/lib/engine/reputation';
import { listEvidenceChainLogs } from '@/lib/engine/evidence';
import { listMemoryQuarantineEntries } from '@/lib/engine/memory/memory-guard';
import { verifyInterAgentTrust } from '@/lib/engine/reputation';

export interface EvidenceChainEntry {
  id: string;
  agentId: string;
  toolName: string;
  status: 'VERIFIED' | 'UNVERIFIED_ACTION';
  evidenceType: string;
  evidenceChainStrength: number;
  timestamp: string;
}

export interface MemoryIntegrityEntry {
  id: string;
  agentId: string;
  source: string;
  status: 'CLEAN' | 'BLOCKED' | 'FLAGGED' | 'QUARANTINED';
  patterns: string[];
  timestamp: string;
}

export interface TrajectoryAnalysisEntry {
  agentId: string;
  agentName: string;
  pattern: string;
  status: 'BLOCKED' | 'MONITORING' | 'CLEAR';
  trajectory: TrajectoryEntry[];
  riskScore: number;
}

export interface TrustHubSnapshot {
  reputations: AgentReputationCard[];
  trajectoryAnalyses: TrajectoryAnalysisEntry[];
  evidenceChain: EvidenceChainEntry[];
  memoryIntegrity: MemoryIntegrityEntry[];
  delegationFlows: InterAgentDelegationFlow[];
}

const AGENT_NAMES: Record<string, string> = {
  'langchain-support-agent-1': 'Support ReAct Agent',
  'crewai-ops-agent-1': 'Ops Coordinator',
  'openai-assistant-1': 'OpenAI Assistant',
};

const DEMO_TRAJECTORIES: TrajectoryAnalysisEntry[] = [
  {
    agentId: 'crewai-ops-agent-1',
    agentName: 'Ops Coordinator',
    pattern: 'read_invoice → read_db → export_csv',
    status: 'BLOCKED',
    riskScore: 92,
    trajectory: [
      {
        toolName: 'read_invoice',
        category: 'read_invoice',
        timestamp: '2026-08-14T11:04:01.000Z',
        baseRiskScore: 18,
      },
      {
        toolName: 'read_db',
        category: 'read_db',
        timestamp: '2026-08-14T11:04:03.000Z',
        baseRiskScore: 22,
      },
      {
        toolName: 'export_csv',
        category: 'export_csv',
        timestamp: '2026-08-14T11:04:06.000Z',
        baseRiskScore: 26,
      },
    ],
  },
  {
    agentId: 'langchain-support-agent-1',
    agentName: 'Support ReAct Agent',
    pattern: 'read → web_search',
    status: 'CLEAR',
    riskScore: 24,
    trajectory: [
      {
        toolName: 'read_file',
        category: 'read',
        timestamp: '2026-08-14T10:55:00.000Z',
        baseRiskScore: 12,
      },
      {
        toolName: 'web_search',
        category: 'api_read',
        timestamp: '2026-08-14T10:55:04.000Z',
        baseRiskScore: 15,
      },
    ],
  },
];

const DEMO_EVIDENCE: EvidenceChainEntry[] = [
  {
    id: 'ev-001',
    agentId: 'crewai-ops-agent-1',
    toolName: 'stripe_transfer',
    status: 'UNVERIFIED_ACTION',
    evidenceType: 'ERP_TRANSACTION_ID',
    evidenceChainStrength: 0,
    timestamp: '2026-08-14T11:02:00.000Z',
  },
  {
    id: 'ev-002',
    agentId: 'langchain-support-agent-1',
    toolName: 'read_invoice',
    status: 'VERIFIED',
    evidenceType: 'SIGNED_API_RESPONSE',
    evidenceChainStrength: 85,
    timestamp: '2026-08-14T10:50:00.000Z',
  },
  {
    id: 'ev-003',
    agentId: 'openai-assistant-1',
    toolName: 'bulk_export_db',
    status: 'UNVERIFIED_ACTION',
    evidenceType: 'DB_MODIFICATION_HASH',
    evidenceChainStrength: 0,
    timestamp: '2026-08-14T09:30:00.000Z',
  },
];

const DEMO_MEMORY: MemoryIntegrityEntry[] = [
  {
    id: 'mem-001',
    agentId: 'crewai-ops-agent-1',
    source: 'vector_db',
    status: 'BLOCKED',
    patterns: ['SYSTEM_OVERRIDE', 'MEMORY_OVERRIDE'],
    timestamp: '2026-08-14T10:40:00.000Z',
  },
  {
    id: 'mem-002',
    agentId: 'langchain-support-agent-1',
    source: 'conversation_buffer',
    status: 'CLEAN',
    patterns: [],
    timestamp: '2026-08-14T10:35:00.000Z',
  },
  {
    id: 'mem-003',
    agentId: 'openai-assistant-1',
    source: 'long_term_memory',
    status: 'FLAGGED',
    patterns: ['PROMPT_LEAK'],
    timestamp: '2026-08-14T09:15:00.000Z',
  },
];

function mapEvidenceLog(entry: EvidenceChainLogEntry): EvidenceChainEntry {
  return {
    id: entry.id,
    agentId: entry.agentId,
    toolName: entry.toolName,
    status: entry.status,
    evidenceType: entry.evidenceType,
    evidenceChainStrength: entry.evidenceChainStrength,
    timestamp: entry.timestamp,
  };
}

function mapMemoryEntry(entry: MemoryQuarantineEntry): MemoryIntegrityEntry {
  return {
    id: entry.id,
    agentId: entry.agentId,
    source: entry.source,
    status: entry.status,
    patterns: entry.patterns,
    timestamp: entry.timestamp,
  };
}

export function buildTrustHubSnapshot(): TrustHubSnapshot {
  verifyInterAgentTrust('langchain-support-agent-1', 'crewai-ops-agent-1');
  verifyInterAgentTrust('openai-assistant-1', 'langchain-support-agent-1');
  verifyInterAgentTrust('crewai-ops-agent-1', 'openai-assistant-1');

  const reputations = listAgentReputationCards();
  const liveEvidence = listEvidenceChainLogs().map(mapEvidenceLog);
  const liveMemory = listMemoryQuarantineEntries().map(mapMemoryEntry);
  const delegationFlows = listInterAgentDelegationFlows(8);

  return {
    reputations: reputations.map((card) => ({
      ...card,
      agentId: card.agentId,
    })),
    trajectoryAnalyses: DEMO_TRAJECTORIES.map((entry) => ({
      ...entry,
      agentName: AGENT_NAMES[entry.agentId] ?? entry.agentName,
    })),
    evidenceChain: liveEvidence.length > 0 ? liveEvidence : DEMO_EVIDENCE,
    memoryIntegrity: liveMemory.length > 0 ? liveMemory : DEMO_MEMORY,
    delegationFlows:
      delegationFlows.length > 0
        ? delegationFlows
        : [
            {
              id: 'deleg-demo-1',
              sourceAgentId: 'langchain-support-agent-1',
              targetAgentId: 'crewai-ops-agent-1',
              recommendation: 'REQUIRE_HUMAN_APPROVAL',
              trustScore: 52,
              timestamp: '2026-08-14T18:00:00.000Z',
            },
            {
              id: 'deleg-demo-2',
              sourceAgentId: 'openai-assistant-1',
              targetAgentId: 'langchain-support-agent-1',
              recommendation: 'ALLOW_DELEGATION',
              trustScore: 78,
              timestamp: '2026-08-14T17:45:00.000Z',
            },
          ],
  };
}

export function getTrustHubSummary(snapshot: TrustHubSnapshot) {
  const avgReputation = Math.round(
    snapshot.reputations.reduce((sum, card) => sum + card.reputationScore, 0) /
      Math.max(snapshot.reputations.length, 1),
  );
  const unverifiedEvidence = snapshot.evidenceChain.filter(
    (entry) => entry.status === 'UNVERIFIED_ACTION',
  ).length;
  const memoryAlerts = snapshot.memoryIntegrity.filter((entry) => entry.status !== 'CLEAN').length;
  const deniedDelegations = snapshot.delegationFlows.filter(
    (flow) => flow.recommendation === 'DENY_DELEGATION',
  ).length;

  return { avgReputation, unverifiedEvidence, memoryAlerts, deniedDelegations };
}
