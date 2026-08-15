import type { AgentAsset, AgentCapability } from '@/lib/engine/discovery';
import { detectEffectiveAuthority, type EffectiveAuthorityReport } from './effective-authority';

export type GraphNodeType = 'agent' | 'tool' | 'external_api' | 'database' | 'user_scope';
export type EffectiveRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type IndirectCapability = 'EXPORT' | 'PAYMENT' | 'CREDENTIAL_ACCESS' | 'DELETE' | 'EXECUTE' | 'WRITE';

export interface GraphNode {
  id: string;
  label: string;
  type: GraphNodeType;
  riskWeight: number;
  metadata?: Record<string, string>;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  relationship: 'uses' | 'calls' | 'accesses' | 'scoped_to';
  indirectCapability?: IndirectCapability;
}

export interface DirectPermissionEntry {
  capability: AgentCapability | string;
  source: 'declared' | 'granted';
}

export interface IndirectCapabilityEntry {
  capability: IndirectCapability | string;
  via: string;
  path: string[];
  elevated: boolean;
}

export interface EffectiveAuthorityGraphResult {
  agentId: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  directPermissions: DirectPermissionEntry[];
  indirectCapabilities: IndirectCapabilityEntry[];
  effectiveRiskScore: number;
  effectiveRiskLevel: EffectiveRiskLevel;
}

const TOOL_CAPABILITY_MAP: Array<{
  pattern: RegExp;
  indirect: IndirectCapability;
  api?: string;
  database?: string;
  riskWeight: number;
}> = [
  {
    pattern: /bulk_export|export_db|export_customer|dump_db|sql_export|pg_dump/i,
    indirect: 'EXPORT',
    database: 'customer_db',
    riskWeight: 35,
  },
  {
    pattern: /stripe|payment|financial|swift|erp_pay|billing/i,
    indirect: 'PAYMENT',
    api: 'payment_gateway',
    riskWeight: 32,
  },
  {
    pattern: /delete|purge|s3_delete|remove_all|drop_table/i,
    indirect: 'DELETE',
    database: 'production_db',
    riskWeight: 38,
  },
  {
    pattern: /exec|shell|run_command|subprocess|terminal/i,
    indirect: 'EXECUTE',
    riskWeight: 30,
  },
  {
    pattern: /write_file|write_db|modify|insert|update/i,
    indirect: 'WRITE',
    database: 'application_db',
    riskWeight: 22,
  },
  {
    pattern: /secret|credential|api_key|token|oauth|password/i,
    indirect: 'CREDENTIAL_ACCESS',
    api: 'secrets_vault',
    riskWeight: 40,
  },
];

const graphCache = new Map<string, EffectiveAuthorityGraphResult>();

function resolveRiskLevel(score: number): EffectiveRiskLevel {
  if (score >= 80) return 'CRITICAL';
  if (score >= 55) return 'HIGH';
  if (score >= 30) return 'MEDIUM';
  return 'LOW';
}

function inferToolIndirect(toolName: string): (typeof TOOL_CAPABILITY_MAP)[number] | null {
  for (const mapping of TOOL_CAPABILITY_MAP) {
    if (mapping.pattern.test(toolName)) return mapping;
  }
  return null;
}

function slug(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
}

function buildUserScopeNode(agent: AgentAsset, report: EffectiveAuthorityReport): GraphNode {
  const tenant = report.elevatedRisks.includes('CROSS_TENANT_ACCESS') ? 'cross_tenant' : 'single_tenant';
  return {
    id: `${agent.id}:scope:${tenant}`,
    label: tenant === 'cross_tenant' ? 'Cross-Tenant User Scope' : 'Single-Tenant User Scope',
    type: 'user_scope',
    riskWeight: tenant === 'cross_tenant' ? 40 : 5,
    metadata: { tenant },
  };
}

export function buildEffectiveAuthorityGraph(
  agent: AgentAsset,
  fileContent?: string,
  authorityReport?: EffectiveAuthorityReport,
): EffectiveAuthorityGraphResult {
  const report = authorityReport ?? detectEffectiveAuthority(agent, fileContent);
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const directPermissions: DirectPermissionEntry[] = agent.capabilities.map((capability) => ({
    capability,
    source: 'declared' as const,
  }));

  const indirectCapabilities: IndirectCapabilityEntry[] = [];
  let effectiveRiskScore = report.riskScore;

  const agentNodeId = `agent:${agent.id}`;
  nodes.push({
    id: agentNodeId,
    label: agent.name,
    type: 'agent',
    riskWeight: 0,
    metadata: { framework: agent.framework },
  });

  const scopeNode = buildUserScopeNode(agent, report);
  nodes.push(scopeNode);
  edges.push({
    id: `${agentNodeId}->${scopeNode.id}`,
    source: agentNodeId,
    target: scopeNode.id,
    relationship: 'scoped_to',
  });

  const seenApis = new Set<string>();
  const seenDatabases = new Set<string>();

  for (const connection of agent.mcpConnections) {
    for (const toolName of connection.tools) {
      const toolNodeId = `tool:${agent.id}:${slug(toolName)}`;
      nodes.push({
        id: toolNodeId,
        label: toolName,
        type: 'tool',
        riskWeight: 5,
        metadata: { mcp: connection.serverName, transport: connection.transport ?? 'stdio' },
      });

      edges.push({
        id: `${agentNodeId}->${toolNodeId}`,
        source: agentNodeId,
        target: toolNodeId,
        relationship: 'uses',
      });

      const mapping = inferToolIndirect(toolName);
      if (!mapping) continue;

      const path = [agent.name, toolName];
      indirectCapabilities.push({
        capability: mapping.indirect,
        via: toolName,
        path,
        elevated: !agent.capabilities.some((cap) =>
          mapping.indirect === 'EXPORT'
            ? cap === 'DB_QUERY' || cap === 'WRITE'
            : mapping.indirect === 'PAYMENT'
              ? cap === 'FINANCIAL'
              : mapping.indirect === 'DELETE'
                ? cap === 'DELETE' || cap === 'WRITE'
                : mapping.indirect === 'EXECUTE'
                  ? cap === 'EXECUTE'
                  : mapping.indirect === 'WRITE'
                    ? cap === 'WRITE'
                    : false,
        ),
      });

      effectiveRiskScore += mapping.riskWeight * 0.35;

      if (mapping.api && !seenApis.has(mapping.api)) {
        seenApis.add(mapping.api);
        const apiNodeId = `api:${agent.id}:${mapping.api}`;
        nodes.push({
          id: apiNodeId,
          label: mapping.api,
          type: 'external_api',
          riskWeight: mapping.riskWeight,
        });
        edges.push({
          id: `${toolNodeId}->${apiNodeId}`,
          source: toolNodeId,
          target: apiNodeId,
          relationship: 'calls',
          indirectCapability: mapping.indirect,
        });
        path.push(mapping.api);
      }

      if (mapping.database && !seenDatabases.has(mapping.database)) {
        seenDatabases.add(mapping.database);
        const dbNodeId = `db:${agent.id}:${mapping.database}`;
        nodes.push({
          id: dbNodeId,
          label: mapping.database,
          type: 'database',
          riskWeight: mapping.riskWeight,
        });
        edges.push({
          id: `${toolNodeId}->${dbNodeId}`,
          source: toolNodeId,
          target: dbNodeId,
          relationship: 'accesses',
          indirectCapability: mapping.indirect,
        });
        path.push(mapping.database);
      }

      const edgeWithCapability = edges.find((edge) => edge.source === toolNodeId && edge.indirectCapability);
      if (edgeWithCapability) {
        edgeWithCapability.indirectCapability = mapping.indirect;
      }
    }

    if (connection.transport === 'http' || connection.transport === 'sse') {
      const apiNodeId = `api:${agent.id}:${slug(connection.serverName)}`;
      if (!seenApis.has(connection.serverName)) {
        seenApis.add(connection.serverName);
        nodes.push({
          id: apiNodeId,
          label: connection.serverName,
          type: 'external_api',
          riskWeight: 18,
          metadata: { transport: connection.transport },
        });
      }
    }
  }

  for (const hidden of report.hiddenPermissions) {
    indirectCapabilities.push({
      capability: hidden,
      via: 'credential_binding',
      path: [agent.name, 'credential_surface', hidden],
      elevated: true,
    });
    effectiveRiskScore += 12;
  }

  if (report.privilegeEscalationDetected) {
    effectiveRiskScore += 20;
  }

  effectiveRiskScore = Math.min(100, Math.round(effectiveRiskScore));
  const effectiveRiskLevel = resolveRiskLevel(effectiveRiskScore);

  const result: EffectiveAuthorityGraphResult = {
    agentId: agent.id,
    nodes,
    edges,
    directPermissions,
    indirectCapabilities,
    effectiveRiskScore,
    effectiveRiskLevel,
  };

  graphCache.set(agent.id, result);
  return result;
}

export function calculateEffectiveAuthorityGraph(agentId: string): EffectiveAuthorityGraphResult {
  const cached = graphCache.get(agentId);
  if (cached) return cached;

  throw new Error(`Discovery graph not built for agent: ${agentId}. Call buildEffectiveAuthorityGraph first.`);
}

export function registerAgentGraph(agent: AgentAsset, fileContent?: string): EffectiveAuthorityGraphResult {
  return buildEffectiveAuthorityGraph(agent, fileContent);
}

export function listCachedDiscoveryGraphs(): EffectiveAuthorityGraphResult[] {
  return [...graphCache.values()];
}

export function resetDiscoveryGraphCache(): void {
  graphCache.clear();
}

export function hasIndirectCapabilityEscalation(result: EffectiveAuthorityGraphResult): boolean {
  return result.indirectCapabilities.some((entry) => entry.elevated);
}
