import type {
  AgentAsset,
  AgentCapability,
  AgentDiscoveryResult,
  AgentRiskLevel,
  DiscoveryFileInput,
} from '@/lib/engine/discovery';
import {
  discoverAgents,
  discoverAgentsInFile,
  summarizeAgentDiscovery,
} from '@/lib/engine/discovery';
import {
  detectEffectiveAuthority,
  formatDeclaredSummary,
  formatEffectiveSummary,
  type EffectiveAuthorityReport,
  type ElevatedRiskScope,
} from './effective-authority';

export type VerifiedStatus = 'VERIFIED' | 'UNVERIFIED' | 'ROGUE';

export interface AgentNhiMetadata {
  ownerDepartment: string;
  verifiedStatus: VerifiedStatus;
  creationTimestamp: string;
  lastActive: string;
}

export interface AgentConnectivityMap {
  connectedToolsCount: number;
  mcpServersCount: number;
  externalApisCount: number;
}

export interface AgentInventoryRecord extends AgentAsset {
  nhi: AgentNhiMetadata;
  connectivity: AgentConnectivityMap;
  authorityReport: EffectiveAuthorityReport;
  /** @deprecated Use authorityReport — kept for backward compatibility */
  effectiveAuthority: LegacyEffectiveAuthorityMatrix;
}

export interface EnvironmentOverview {
  totalAiAgents: number;
  connectedTools: number;
  mcpServers: number;
  unknownRogueAgents: number;
}

export interface EnvironmentScanResult {
  overview: EnvironmentOverview;
  agents: AgentInventoryRecord[];
  scannedAt: string;
}

export interface ScanEnvironmentInput {
  files?: DiscoveryFileInput[];
  agents?: AgentAsset[];
  fileContents?: Map<string, string>;
  nhiMetadata?: Map<string, Partial<AgentNhiMetadata>>;
}

/** @deprecated Legacy matrix shape — derived from authorityReport for UI compat */
export interface LegacyEffectiveAuthorityMatrix {
  declared: AgentCapability[];
  effective: Array<{
    scope: string;
    source: string;
    riskLevel: AgentRiskLevel;
    detail: string;
  }>;
  overallRisk: AgentRiskLevel;
  hasUnrestrictedWrite: boolean;
  hasUnrestrictedDelete: boolean;
  hasFinancialAccess: boolean;
}

export type EnrichedAgentAsset = AgentInventoryRecord;
export type EnrichedAgentDiscoveryResult = EnvironmentScanResult;

export type EffectiveAuthorityScope = ElevatedRiskScope | 'FULL_DB_ADMIN' | 'READ_ONLY';

const RISK_ORDER: AgentRiskLevel[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

function riskFromScore(score: number): AgentRiskLevel {
  if (score >= 75) return 'CRITICAL';
  if (score >= 50) return 'HIGH';
  if (score >= 25) return 'MEDIUM';
  return 'LOW';
}

function toLegacyMatrix(agent: AgentAsset, report: EffectiveAuthorityReport): LegacyEffectiveAuthorityMatrix {
  const overallRisk = riskFromScore(report.riskScore);

  return {
    declared: agent.capabilities,
    effective: report.entries.map((entry) => ({
      scope: entry.scope,
      source: entry.source,
      riskLevel: entry.elevated ? (report.riskScore >= 75 ? 'CRITICAL' : 'HIGH') : 'MEDIUM',
      detail: entry.detail,
    })),
    overallRisk,
    hasUnrestrictedWrite: report.effectiveScopes.some((scope) => /FULL WRITE|FULL DB ADMIN/i.test(scope)),
    hasUnrestrictedDelete: report.elevatedRisks.includes('UNRESTRICTED_DELETE'),
    hasFinancialAccess: report.elevatedRisks.includes('FINANCIAL_EXECUTE'),
  };
}

function countExternalApis(agent: AgentAsset, fileContent?: string): number {
  let count = agent.capabilities.includes('API_CALL') ? 1 : 0;
  if (fileContent) {
    const apiMatches = fileContent.match(/https?:\/\/[^\s'"]+|api_key|API_URL|BASE_URL/gi);
    count += apiMatches ? Math.min(apiMatches.length, 10) : 0;
  }
  return count;
}

function buildConnectivity(agent: AgentAsset, fileContent?: string): AgentConnectivityMap {
  const connectedToolsCount = agent.mcpConnections.reduce(
    (sum, connection) => sum + connection.tools.length,
    0,
  );

  return {
    connectedToolsCount,
    mcpServersCount: agent.mcpConnections.length,
    externalApisCount: countExternalApis(agent, fileContent),
  };
}

function inferNhiMetadata(agent: AgentAsset, report: EffectiveAuthorityReport): AgentNhiMetadata {
  const rogue =
    report.privilegeEscalationDetected &&
    report.elevatedRisks.length > 0 &&
    !agent.capabilities.includes('FINANCIAL') &&
    !agent.capabilities.includes('EXECUTE');

  const unverified = report.hiddenPermissions.length > 0 && !rogue;

  return {
    ownerDepartment: inferDepartment(agent),
    verifiedStatus: rogue ? 'ROGUE' : unverified ? 'UNVERIFIED' : 'VERIFIED',
    creationTimestamp: inferCreationTimestamp(agent),
    lastActive: new Date().toISOString(),
  };
}

function inferDepartment(agent: AgentAsset): string {
  if (/support|customer/i.test(agent.name)) return 'Customer Support';
  if (/ops|coordinator/i.test(agent.name)) return 'Operations';
  if (/finance|billing/i.test(agent.name)) return 'Finance';
  if (agent.framework === 'MCP') return 'Platform Engineering';
  return 'Engineering';
}

function inferCreationTimestamp(agent: AgentAsset): string {
  const seed = agent.id.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const daysAgo = (seed % 180) + 1;
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString();
}

export function buildAgentInventoryRecord(
  agent: AgentAsset,
  fileContent?: string,
  nhiOverride?: Partial<AgentNhiMetadata>,
): AgentInventoryRecord {
  const authorityReport = detectEffectiveAuthority(agent, fileContent);
  const nhi = { ...inferNhiMetadata(agent, authorityReport), ...nhiOverride };

  return {
    ...agent,
    nhi,
    connectivity: buildConnectivity(agent, fileContent),
    authorityReport,
    effectiveAuthority: toLegacyMatrix(agent, authorityReport),
  };
}

export function scanEnvironment(input: ScanEnvironmentInput = {}): EnvironmentScanResult {
  let agents: AgentAsset[] = [];

  if (input.files?.length) {
    agents = discoverAgents(input.files).agents;
  } else if (input.agents?.length) {
    agents = input.agents;
  }

  const contentMap =
    input.fileContents ??
    new Map(input.files?.map((file) => [file.path.replace(/\\/g, '/'), file.content]) ?? []);

  const inventoryAgents = agents.map((agent) =>
    buildAgentInventoryRecord(
      agent,
      contentMap.get(agent.sourceFile),
      input.nhiMetadata?.get(agent.id),
    ),
  );

  const mcpServerNames = new Set<string>();
  let connectedTools = 0;

  for (const agent of inventoryAgents) {
    connectedTools += agent.connectivity.connectedToolsCount;
    for (const connection of agent.mcpConnections) {
      mcpServerNames.add(connection.serverName);
    }
  }

  const unknownRogueAgents = inventoryAgents.filter(
    (agent) => agent.nhi.verifiedStatus === 'ROGUE' || agent.nhi.verifiedStatus === 'UNVERIFIED',
  ).length;

  return {
    overview: {
      totalAiAgents: inventoryAgents.length,
      connectedTools,
      mcpServers: mcpServerNames.size,
      unknownRogueAgents,
    },
    agents: inventoryAgents,
    scannedAt: new Date().toISOString(),
  };
}

/** @deprecated Use detectEffectiveAuthority */
export function computeEffectiveAuthority(agent: AgentAsset, fileContent?: string) {
  const report = detectEffectiveAuthority(agent, fileContent);
  return toLegacyMatrix(agent, report);
}

export function enrichAgentAsset(agent: AgentAsset, fileContent?: string): AgentInventoryRecord {
  return buildAgentInventoryRecord(agent, fileContent);
}

export function enrichAgentInventory(
  agents: AgentAsset[],
  fileContents?: Map<string, string>,
): AgentInventoryRecord[] {
  return agents.map((agent) =>
    buildAgentInventoryRecord(agent, fileContents?.get(agent.sourceFile)),
  );
}

export function discoverAgentsWithAuthority(files: DiscoveryFileInput[]): EnvironmentScanResult {
  return scanEnvironment({ files });
}

export {
  detectEffectiveAuthority,
  formatDeclaredSummary,
  formatEffectiveSummary,
};

export {
  buildEffectiveAuthorityGraph,
  calculateEffectiveAuthorityGraph,
  registerAgentGraph,
  hasIndirectCapabilityEscalation,
  resetDiscoveryGraphCache,
} from './discovery-graph';

export type {
  EffectiveAuthorityGraphResult,
  GraphNode,
  GraphEdge,
  EffectiveRiskLevel,
  IndirectCapabilityEntry,
} from './discovery-graph';

export type { EffectiveAuthorityReport, ElevatedRiskScope } from './effective-authority';

export {
  discoverAgents,
  discoverAgentsInFile,
  summarizeAgentDiscovery,
};

export type {
  AgentAsset,
  AgentCapability,
  AgentDiscoveryResult,
  AgentFramework,
  AgentRiskLevel,
  McpConnection,
  DiscoveryFileInput,
} from '@/lib/engine/discovery';
