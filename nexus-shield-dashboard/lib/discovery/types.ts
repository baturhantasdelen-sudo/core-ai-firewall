/**
 * P0 Sprint 1-2 — Agent Discovery & Network Visibility
 * Supabase/Postgres persistence schema (no Prisma in this project).
 */
export type AgentInventoryType =
  | 'LANGCHAIN'
  | 'AUTOGEN'
  | 'MCP_SERVER'
  | 'CUSTOM_AGENT'
  | 'SHADOW_AGENT';

export type AgentInventoryStatus = 'ACTIVE' | 'INACTIVE' | 'QUARANTINED';

/** Canonical agent inventory record for network-wide discovery. */
export interface AgentInventory {
  id: string;
  name: string;
  type: AgentInventoryType;
  status: AgentInventoryStatus;
  endpoint: string;
  detectedAt: string;
  /** 0–100 composite risk score */
  riskScore: number;
  mcpToolsCount: number;
}

export interface DiscoverySummary {
  totalAgents: number;
  shadowAgents: number;
  mcpServers: number;
  highRiskAgents: number;
}

export interface DiscoveryScanResult {
  agents: AgentInventory[];
  summary: DiscoverySummary;
  scannedAt: string;
  source: 'mock' | 'network' | 'hybrid';
}

/** Normalized eBPF / network flow log line for agent heuristics. */
export interface NetworkFlowLog {
  timestamp: string;
  srcIp: string;
  dstIp: string;
  dstPort: number;
  protocol: 'TCP' | 'UDP';
  bytes: number;
  processName?: string;
  userAgent?: string;
  payloadHint?: string;
}

export const HIGH_RISK_SCORE_THRESHOLD = 70;

export function summarizeDiscovery(agents: AgentInventory[]): DiscoverySummary {
  return {
    totalAgents: agents.length,
    shadowAgents: agents.filter((a) => a.type === 'SHADOW_AGENT').length,
    mcpServers: agents.filter((a) => a.type === 'MCP_SERVER').length,
    highRiskAgents: agents.filter((a) => a.riskScore >= HIGH_RISK_SCORE_THRESHOLD).length,
  };
}
