import type { ActionDecision } from '@/lib/engine/action-firewall';

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
  violations: string[];
  killSwitchTriggered: boolean;
  agentStatus: 'ACTIVE' | 'FROZEN';
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
    violations: [],
    killSwitchTriggered: false,
    agentStatus: 'ACTIVE',
  },
  {
    id: 'action_002',
    timestamp: '2026-08-14T16:43:02.000Z',
    agentId: 'crewai-ops-agent-1',
    agentName: 'Ops Coordinator',
    userIntent: 'Invoice Check for customer #4421',
    toolName: 'bulk_export_db',
    toolArgs: { table: 'customers', format: 'csv' },
    decision: 'BLOCK',
    riskScore: 91,
    intentMatchScore: 22,
    violations: [
      'Agent lacks required capability: DB_QUERY',
      'Intent-Action mismatch: invoice check intent vs bulk database export tool',
    ],
    killSwitchTriggered: true,
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
    violations: [],
    killSwitchTriggered: false,
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
    violations: ['Agent lacks required capability: FINANCIAL'],
    killSwitchTriggered: false,
    agentStatus: 'ACTIVE',
  },
];

export function getActionFirewallSummary() {
  const blocked = mockActionFirewallLogs.filter((entry) => entry.decision === 'BLOCK').length;
  const approval = mockActionFirewallLogs.filter(
    (entry) => entry.decision === 'HUMAN_APPROVAL_REQUIRED',
  ).length;
  const allowed = mockActionFirewallLogs.filter((entry) => entry.decision === 'ALLOW').length;
  const frozen = mockActionFirewallLogs.filter((entry) => entry.agentStatus === 'FROZEN').length;

  return {
    total: mockActionFirewallLogs.length,
    allowed,
    blocked,
    approvalRequired: approval,
    frozenAgents: frozen,
  };
}
