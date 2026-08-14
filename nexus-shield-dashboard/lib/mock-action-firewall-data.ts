import type { ActionDecision } from '@/lib/engine/action-firewall';
import type { DivergenceSeverity } from '@/lib/engine/action-firewall/intent-divergence';

export interface ActionFirewallLogEntry {
  id: string;
  timestamp: string;
  agentId: string;
  agentName: string;
  userIntent: string;
  toolName: string;
  toolArgs: Record<string, unknown>;
  decision: ActionDecision;
  riskScore: number;
  intentMatchScore: number;
  intentDivergenceScore: number;
  divergenceSeverity: DivergenceSeverity;
  violations: string[];
  killSwitchTriggered: boolean;
  capabilitiesRevoked: boolean;
  agentStatus: 'ACTIVE' | 'FROZEN' | 'READ_ONLY';
}

export const mockActionFirewallLogs: ActionFirewallLogEntry[] = [
  {
    id: 'action_001',
    timestamp: '2026-08-14T16:42:11.000Z',
    agentId: 'crewai-ops-agent-1',
    agentName: 'Ops Coordinator',
    userIntent: 'Invoice Check for customer #4421',
    toolName: 'read_invoice',
    toolArgs: { customer_id: '4421' },
    decision: 'ALLOW',
    riskScore: 18,
    intentMatchScore: 88,
    intentDivergenceScore: 12,
    divergenceSeverity: 'LOW',
    violations: [],
    killSwitchTriggered: false,
    capabilitiesRevoked: false,
    agentStatus: 'ACTIVE',
  },
  {
    id: 'action_002',
    timestamp: '2026-08-14T16:43:02.000Z',
    agentId: 'crewai-ops-agent-1',
    agentName: 'Ops Coordinator',
    userIntent: 'Invoice Check for customer #4421',
    toolName: 'export_customer_database',
    toolArgs: { table: 'customers', format: 'csv' },
    decision: 'BLOCK',
    riskScore: 96,
    intentMatchScore: 22,
    intentDivergenceScore: 96,
    divergenceSeverity: 'CRITICAL',
    violations: [
      'Agent lacks required capability: DB_QUERY',
      'Intent-Action mismatch: invoice check intent vs bulk database export tool',
      'INTENT_ACTION_DIVERGENCE: 96% mismatch between user intent and action trajectory',
      'Critical mismatch: invoice review intent vs export_customer_database',
    ],
    killSwitchTriggered: true,
    capabilitiesRevoked: false,
    agentStatus: 'FROZEN',
  },
  {
    id: 'action_003',
    timestamp: '2026-08-14T16:44:27.000Z',
    agentId: 'langchain-support-agent-1',
    agentName: 'Support ReAct Agent',
    userIntent: 'Find latest shipping update',
    toolName: 'web_search',
    toolArgs: { query: 'order 7781 shipping status' },
    decision: 'ALLOW',
    riskScore: 12,
    intentMatchScore: 82,
    intentDivergenceScore: 18,
    divergenceSeverity: 'LOW',
    violations: [],
    killSwitchTriggered: false,
    capabilitiesRevoked: false,
    agentStatus: 'ACTIVE',
  },
  {
    id: 'action_004',
    timestamp: '2026-08-14T16:45:09.000Z',
    agentId: 'openai-assistant-1',
    agentName: 'Customer Assistant',
    userIntent: 'Review account balance',
    toolName: 'stripe_transfer',
    toolArgs: { amount: 5000, currency: 'try' },
    decision: 'HUMAN_APPROVAL_REQUIRED',
    riskScore: 68,
    intentMatchScore: 41,
    intentDivergenceScore: 59,
    divergenceSeverity: 'MEDIUM',
    violations: ['Agent lacks required capability: FINANCIAL'],
    killSwitchTriggered: false,
    capabilitiesRevoked: false,
    agentStatus: 'ACTIVE',
  },
  {
    id: 'action_005',
    timestamp: '2026-08-14T16:46:33.000Z',
    agentId: 'rogue-shadow-agent-1',
    agentName: 'Shadow Invoice Bot',
    userIntent: 'Invoice Check for customer #9912',
    toolName: 'write_file',
    toolArgs: { path: '/data/invoices/export.csv' },
    decision: 'BLOCK',
    riskScore: 72,
    intentMatchScore: 35,
    intentDivergenceScore: 84,
    divergenceSeverity: 'CRITICAL',
    violations: [
      'Capability revoked (read-only mode): WRITE',
      'INTENT_ACTION_DIVERGENCE: 84% mismatch between user intent and action trajectory',
    ],
    killSwitchTriggered: false,
    capabilitiesRevoked: true,
    agentStatus: 'READ_ONLY',
  },
];

export function getActionFirewallSummary() {
  const blocked = mockActionFirewallLogs.filter((entry) => entry.decision === 'BLOCK').length;
  const approval = mockActionFirewallLogs.filter(
    (entry) => entry.decision === 'HUMAN_APPROVAL_REQUIRED',
  ).length;
  const allowed = mockActionFirewallLogs.filter((entry) => entry.decision === 'ALLOW').length;
  const frozen = mockActionFirewallLogs.filter((entry) => entry.agentStatus === 'FROZEN').length;
  const readOnly = mockActionFirewallLogs.filter((entry) => entry.agentStatus === 'READ_ONLY').length;

  return {
    total: mockActionFirewallLogs.length,
    allowed,
    blocked,
    approvalRequired: approval,
    frozenAgents: frozen,
    readOnlyAgents: readOnly,
  };
}

export function getCapabilityManagedAgents() {
  const agentMap = new Map<string, { agentId: string; agentName: string; agentStatus: ActionFirewallLogEntry['agentStatus'] }>();
  for (const log of mockActionFirewallLogs) {
    if (log.agentStatus === 'READ_ONLY' || log.agentStatus === 'FROZEN') {
      agentMap.set(log.agentId, {
        agentId: log.agentId,
        agentName: log.agentName,
        agentStatus: log.agentStatus,
      });
    }
  }
  return [...agentMap.values()];
}
