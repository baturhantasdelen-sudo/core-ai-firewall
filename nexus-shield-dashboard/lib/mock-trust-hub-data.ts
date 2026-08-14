import type { TrajectoryEntry } from '@/lib/engine/action-firewall/trajectory';
import type { AgentReputationRecord } from '@/lib/engine/reputation';

export interface EvidenceChainEntry {
  id: string;
  agentId: string;
  toolName: string;
  status: 'VERIFIED' | 'UNVERIFIED_ACTION';
  evidenceType: string;
  timestamp: string;
}

export interface MemoryIntegrityEntry {
  id: string;
  agentId: string;
  source: string;
  status: 'CLEAN' | 'BLOCKED' | 'FLAGGED';
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
  reputations: AgentReputationRecord[];
  trajectoryAnalyses: TrajectoryAnalysisEntry[];
  evidenceChain: EvidenceChainEntry[];
  memoryIntegrity: MemoryIntegrityEntry[];
}

export function buildTrustHubSnapshot(): TrustHubSnapshot {
  return {
    reputations: [
      {
        agentId: 'langchain-support-agent-1',
        score: 82,
        successfulActions: 1240,
        violations: 3,
        incidents: [],
        lastUpdated: '2026-08-14T20:00:00.000Z',
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
            type: 'TOOL_CHAIN_ESCALATION',
            severity: 'HIGH',
            timestamp: '2026-08-14T11:05:00.000Z',
            resolved: false,
          },
        ],
        lastUpdated: '2026-08-14T20:00:00.000Z',
      },
      {
        agentId: 'openai-assistant-1',
        score: 76,
        successfulActions: 560,
        violations: 5,
        incidents: [],
        lastUpdated: '2026-08-14T20:00:00.000Z',
      },
    ],
    trajectoryAnalyses: [
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
    ],
    evidenceChain: [
      {
        id: 'ev-001',
        agentId: 'crewai-ops-agent-1',
        toolName: 'stripe_transfer',
        status: 'UNVERIFIED_ACTION',
        evidenceType: 'erpTransactionId',
        timestamp: '2026-08-14T11:02:00.000Z',
      },
      {
        id: 'ev-002',
        agentId: 'langchain-support-agent-1',
        toolName: 'read_invoice',
        status: 'VERIFIED',
        evidenceType: 'apiLogDiff',
        timestamp: '2026-08-14T10:50:00.000Z',
      },
      {
        id: 'ev-003',
        agentId: 'openai-assistant-1',
        toolName: 'bulk_export_db',
        status: 'UNVERIFIED_ACTION',
        evidenceType: 'dbModificationHash',
        timestamp: '2026-08-14T09:30:00.000Z',
      },
    ],
    memoryIntegrity: [
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
    ],
  };
}
