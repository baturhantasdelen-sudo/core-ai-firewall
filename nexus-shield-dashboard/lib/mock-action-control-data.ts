import type { McpRuntimeDecision } from '@/lib/engine/mcp/mcp-runtime';
import type { TrajectoryRiskLevel } from '@/lib/engine/action-firewall/trajectory-engine';
import type { ApprovalStatus } from '@/lib/engine/action-firewall/human-approval';

export interface TrajectoryControlLogEntry {
  id: string;
  timestamp: string;
  agentId: string;
  agentName: string;
  sequence: string[];
  trajectoryRisk: TrajectoryRiskLevel;
  sequenceViolationDetected: boolean;
  unsafeSequenceReason: string;
  matchedPattern?: string;
}

export interface McpRuntimeLogEntry {
  id: string;
  timestamp: string;
  mcpServerId: string;
  toolName: string;
  decision: McpRuntimeDecision;
  riskScore: number;
  violations: string[];
  dimensions: string[];
}

export interface PendingApprovalEntry {
  id: string;
  agentId: string;
  agentName: string;
  toolName: string;
  userIntent: string;
  riskScore: number;
  status: ApprovalStatus;
  createdAt: string;
  expiresAt: string;
  trajectoryReason?: string;
  mcpServerId?: string;
}

export const mockTrajectoryControlLogs: TrajectoryControlLogEntry[] = [
  {
    id: 'traj_001',
    timestamp: '2026-08-14T16:42:45.000Z',
    agentId: 'crewai-ops-agent-1',
    agentName: 'Ops Coordinator',
    sequence: ['read_db', 'call_api', 'write_file'],
    trajectoryRisk: 'CRITICAL',
    sequenceViolationDetected: true,
    unsafeSequenceReason:
      'Data exfiltration chain: database read followed by external API call and file write',
    matchedPattern: 'READ_DB → CALL_API → WRITE_FILE',
  },
  {
    id: 'traj_002',
    timestamp: '2026-08-14T16:43:18.000Z',
    agentId: 'langchain-support-agent-1',
    agentName: 'Support ReAct Agent',
    sequence: ['read_db', 'call_api'],
    trajectoryRisk: 'MEDIUM',
    sequenceViolationDetected: false,
    unsafeSequenceReason: '',
  },
];

export const mockMcpRuntimeLogs: McpRuntimeLogEntry[] = [
  {
    id: 'mcp_001',
    timestamp: '2026-08-14T16:44:01.000Z',
    mcpServerId: 'postgres-mcp',
    toolName: 'bulk_export_db',
    decision: 'REQUIRE_APPROVAL',
    riskScore: 50,
    violations: ['Agent lacks capability for high-risk MCP tool "bulk_export_db"'],
    dimensions: ['IDENTITY', 'PERMISSIONS', 'NETWORK', 'DATA'],
  },
  {
    id: 'mcp_002',
    timestamp: '2026-08-14T16:44:55.000Z',
    mcpServerId: 'shadow-postgres',
    toolName: 'execute_shell',
    decision: 'ISOLATE',
    riskScore: 80,
    violations: [
      'Unregistered MCP server identity: shadow-postgres',
      'Agent lacks capability for high-risk MCP tool "execute_shell"',
    ],
    dimensions: ['IDENTITY', 'PERMISSIONS', 'NETWORK', 'DATA'],
  },
  {
    id: 'mcp_003',
    timestamp: '2026-08-14T16:45:30.000Z',
    mcpServerId: 'filesystem-mcp',
    toolName: 'read_file',
    decision: 'ALLOW',
    riskScore: 0,
    violations: [],
    dimensions: ['IDENTITY', 'PERMISSIONS', 'NETWORK', 'DATA'],
  },
];

export const mockPendingApprovals: PendingApprovalEntry[] = [
  {
    id: 'apr_demo_001',
    agentId: 'openai-assistant-1',
    agentName: 'Customer Assistant',
    toolName: 'stripe_transfer',
    userIntent: 'Review account balance',
    riskScore: 68,
    status: 'pending',
    createdAt: '2026-08-14T16:45:09.000Z',
    expiresAt: '2026-08-14T17:00:09.000Z',
    mcpServerId: 'stripe-mcp',
  },
  {
    id: 'apr_demo_002',
    agentId: 'crewai-ops-agent-1',
    agentName: 'Ops Coordinator',
    toolName: 'bulk_export_db',
    userIntent: 'Invoice Check for customer #4421',
    riskScore: 75,
    status: 'pending',
    createdAt: '2026-08-14T16:46:12.000Z',
    expiresAt: '2026-08-14T17:01:12.000Z',
    trajectoryReason: 'Progressive data harvesting ending in bulk export',
    mcpServerId: 'postgres-mcp',
  },
];

export function getActionControlSummary() {
  return {
    trajectoryViolations: mockTrajectoryControlLogs.filter((entry) => entry.sequenceViolationDetected)
      .length,
    mcpBlocked: mockMcpRuntimeLogs.filter((entry) => entry.decision === 'BLOCK' || entry.decision === 'ISOLATE')
      .length,
    mcpApprovalRequired: mockMcpRuntimeLogs.filter((entry) => entry.decision === 'REQUIRE_APPROVAL')
      .length,
    pendingApprovals: mockPendingApprovals.filter((entry) => entry.status === 'pending').length,
  };
}
