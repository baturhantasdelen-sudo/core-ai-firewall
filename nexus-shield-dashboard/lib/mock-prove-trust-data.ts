import type { VerificationStatus } from '@/lib/engine/evidence/evidential-verifier';
import type { TrustTier } from '@/lib/engine/reputation/dynamic-trust-score';

export interface EvidentialVerificationLogEntry {
  id: string;
  agentId: string;
  agentName: string;
  toolName: string;
  verificationStatus: VerificationStatus;
  confidenceScore: number;
  missingProofs: string[];
  timestamp: string;
}

export interface DynamicTrustScoreEntry {
  agentId: string;
  agentName: string;
  score: number;
  tier: TrustTier;
  previousScore?: number;
  restrictions: string[];
  history: Array<{ score: number; tier: TrustTier; timestamp: string }>;
}

export interface ImmuneSignatureFeedEntry {
  id: string;
  signatureHash: string;
  anonymizedPattern: string[];
  category: string;
  severity: string;
  syncedAt: string;
  networkReach: number;
}

export interface ProveTrustSnapshot {
  evidentialLogs: EvidentialVerificationLogEntry[];
  dynamicTrustScores: DynamicTrustScoreEntry[];
  immuneSignatureFeed: ImmuneSignatureFeedEntry[];
}

export const mockEvidentialLogs: EvidentialVerificationLogEntry[] = [
  {
    id: 'ev-out-001',
    agentId: 'crewai-ops-agent-1',
    agentName: 'Ops Coordinator',
    toolName: 'stripe_transfer',
    verificationStatus: 'UNVERIFIED',
    confidenceScore: 0,
    missingProofs: ['TRANSACTION_ID', 'BANK_API_RESPONSE', 'AUTHORIZED_AGENT_SIGNATURE'],
    timestamp: '2026-08-14T16:50:00.000Z',
  },
  {
    id: 'ev-out-002',
    agentId: 'langchain-support-agent-1',
    agentName: 'Support ReAct Agent',
    toolName: 'read_invoice',
    verificationStatus: 'VERIFIED',
    confidenceScore: 92,
    missingProofs: [],
    timestamp: '2026-08-14T16:48:00.000Z',
  },
  {
    id: 'ev-out-003',
    agentId: 'openai-assistant-1',
    agentName: 'Customer Assistant',
    toolName: 'bulk_export_db',
    verificationStatus: 'INSUFFICIENT_EVIDENCE',
    confidenceScore: 42,
    missingProofs: ['EXECUTION_LOG', 'AUTHORIZED_AGENT_SIGNATURE'],
    timestamp: '2026-08-14T16:47:00.000Z',
  },
];

export const mockDynamicTrustScores: DynamicTrustScoreEntry[] = [
  {
    agentId: 'langchain-support-agent-1',
    agentName: 'Support ReAct Agent',
    score: 91,
    tier: 'NORMAL',
    previousScore: 93,
    restrictions: [],
    history: [
      { score: 93, tier: 'NORMAL', timestamp: '2026-08-14T16:40:00.000Z' },
      { score: 92, tier: 'NORMAL', timestamp: '2026-08-14T16:45:00.000Z' },
      { score: 91, tier: 'NORMAL', timestamp: '2026-08-14T16:50:00.000Z' },
    ],
  },
  {
    agentId: 'crewai-ops-agent-1',
    agentName: 'Ops Coordinator',
    score: 52,
    tier: 'RESTRICTED',
    previousScore: 78,
    restrictions: ['BLOCK_PAYMENT', 'BLOCK_EXPORT', 'REQUIRE_APPROVAL_WRITE'],
    history: [
      { score: 78, tier: 'ELEVATED', timestamp: '2026-08-14T16:30:00.000Z' },
      { score: 65, tier: 'RESTRICTED', timestamp: '2026-08-14T16:40:00.000Z' },
      { score: 52, tier: 'RESTRICTED', timestamp: '2026-08-14T16:50:00.000Z' },
    ],
  },
  {
    agentId: 'rogue-shadow-agent-1',
    agentName: 'Shadow Invoice Bot',
    score: 28,
    tier: 'CRITICAL',
    previousScore: 55,
    restrictions: ['BLOCK_PAYMENT', 'BLOCK_EXPORT', 'REQUIRE_APPROVAL_WRITE', 'AGENT_FROZEN'],
    history: [
      { score: 55, tier: 'RESTRICTED', timestamp: '2026-08-14T16:35:00.000Z' },
      { score: 38, tier: 'CRITICAL', timestamp: '2026-08-14T16:42:00.000Z' },
      { score: 28, tier: 'CRITICAL', timestamp: '2026-08-14T16:50:00.000Z' },
    ],
  },
];

export const mockImmuneSignatureFeed: ImmuneSignatureFeedEntry[] = [
  {
    id: '#TS-1001',
    signatureHash: 'a3f8c2d1e9b04716',
    anonymizedPattern: ['step:db_read', 'step:api_call', 'step:write'],
    category: 'DATA_EXFILTRATION',
    severity: 'CRITICAL',
    syncedAt: '2026-08-14T16:51:00.000Z',
    networkReach: 12,
  },
  {
    id: '#TS-1002',
    signatureHash: 'b7e4a1f0c8d32905',
    anonymizedPattern: ['step:db_read', 'step:export'],
    category: 'TRAJECTORY_CHAIN',
    severity: 'HIGH',
    syncedAt: '2026-08-14T16:49:00.000Z',
    networkReach: 11,
  },
  {
    id: '#TS-1003',
    signatureHash: 'c1d9e2f3a4b56780',
    anonymizedPattern: ['step:financial', 'step:api_call'],
    category: 'PRIVILEGE_ESCALATION',
    severity: 'HIGH',
    syncedAt: '2026-08-14T16:46:00.000Z',
    networkReach: 10,
  },
];

export function buildProveTrustSnapshot(): ProveTrustSnapshot {
  return {
    evidentialLogs: mockEvidentialLogs,
    dynamicTrustScores: mockDynamicTrustScores,
    immuneSignatureFeed: mockImmuneSignatureFeed,
  };
}

export function getProveTrustSummary(snapshot: ProveTrustSnapshot) {
  return {
    verified: snapshot.evidentialLogs.filter((e) => e.verificationStatus === 'VERIFIED').length,
    unverified: snapshot.evidentialLogs.filter((e) => e.verificationStatus === 'UNVERIFIED').length,
    insufficient: snapshot.evidentialLogs.filter((e) => e.verificationStatus === 'INSUFFICIENT_EVIDENCE')
      .length,
    frozenAgents: snapshot.dynamicTrustScores.filter((e) => e.tier === 'CRITICAL').length,
    immuneSignatures: snapshot.immuneSignatureFeed.length,
  };
}
