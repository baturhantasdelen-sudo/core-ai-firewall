import type { AgentAsset } from '@/lib/engine/discovery';
import { detectEffectiveAuthority } from '@/lib/engine/agents/effective-authority';
import {
  annotateGraphWithRisks,
  classifyAgentTools,
  detectCombinatorialRisks,
  hasPrivilegeEscalation,
  scoreCombinatorialRisks,
} from '@/lib/authority/detector';
import type {
  AgentAuthorityInput,
  AuthorityEdge,
  AuthorityGraph,
  AuthorityNode,
  EffectiveAuthorityResult,
} from '@/lib/authority/types';
import { resolveEffectiveRiskLevel } from '@/lib/authority/types';

function slug(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
}

function agentAssetToInput(agent: AgentAsset, fileContent?: string): AgentAuthorityInput {
  return {
    id: agent.id,
    name: agent.name,
    framework: agent.framework,
    capabilities: agent.capabilities,
    mcpConnections: agent.mcpConnections,
    fileContent,
  };
}

function inferResourceNodes(
  agentId: string,
  toolName: string,
  toolNodeId: string,
  nodes: AuthorityNode[],
  edges: AuthorityEdge[],
): void {
  if (/invoice|customer|pii|record/i.test(toolName)) {
    const assetId = `asset:${agentId}:${slug(toolName)}`;
    nodes.push({
      id: assetId,
      label: 'Invoice / Customer Data',
      type: 'DataAsset',
      riskWeight: 20,
      metadata: { sensitivity: 'high' },
    });
    edges.push({
      id: `${toolNodeId}->${assetId}`,
      sourceId: toolNodeId,
      targetId: assetId,
      relation: 'reads',
    });
  }

  if (/sql|db|postgres|mysql|query|export/i.test(toolName)) {
    const dbId = `db:${agentId}:${slug(toolName)}`;
    nodes.push({
      id: dbId,
      label: 'Production Database',
      type: 'Database',
      riskWeight: 28,
    });
    edges.push({
      id: `${toolNodeId}->${dbId}`,
      sourceId: toolNodeId,
      targetId: dbId,
      relation: /export|dump|bulk/i.test(toolName) ? 'writes' : 'accesses',
    });
  }

  if (/http|webhook|curl|fetch_url|send_/i.test(toolName)) {
    const apiId = `api:${agentId}:${slug(toolName)}`;
    nodes.push({
      id: apiId,
      label: 'External HTTP Endpoint',
      type: 'ExternalAPI',
      riskWeight: 30,
      metadata: { egress: 'true' },
    });
    edges.push({
      id: `${toolNodeId}->${apiId}`,
      sourceId: toolNodeId,
      targetId: apiId,
      relation: 'calls',
    });
  }

  if (/stripe|payment|financial|swift|erp/i.test(toolName)) {
    const apiId = `api:${agentId}:payment_gateway`;
    if (!nodes.some((n) => n.id === apiId)) {
      nodes.push({
        id: apiId,
        label: 'Payment Gateway API',
        type: 'ExternalAPI',
        riskWeight: 35,
        metadata: { financial: 'true' },
      });
    }
    edges.push({
      id: `${toolNodeId}->${apiId}`,
      sourceId: toolNodeId,
      targetId: apiId,
      relation: 'calls',
    });
  }
}

function buildGraphStructure(input: AgentAuthorityInput): AuthorityGraph {
  const nodes: AuthorityNode[] = [];
  const edges: AuthorityEdge[] = [];
  const toolCapabilities: string[] = [];

  const agentNodeId = `agent:${input.id}`;
  nodes.push({
    id: agentNodeId,
    label: input.name,
    type: 'Agent',
    riskWeight: 0,
    metadata: { framework: input.framework },
  });

  for (const connection of input.mcpConnections) {
    for (const toolName of connection.tools) {
      toolCapabilities.push(toolName);
      const toolNodeId = `tool:${input.id}:${slug(toolName)}`;
      nodes.push({
        id: toolNodeId,
        label: toolName,
        type: 'Tool',
        riskWeight: 8,
        metadata: {
          mcpServer: connection.serverName,
          transport: connection.transport ?? 'stdio',
        },
      });
      edges.push({
        id: `${agentNodeId}->${toolNodeId}`,
        sourceId: agentNodeId,
        targetId: toolNodeId,
        relation: 'uses',
      });
      inferResourceNodes(input.id, toolName, toolNodeId, nodes, edges);
    }

    if (connection.transport === 'http' || connection.transport === 'sse') {
      const apiId = `api:${input.id}:${slug(connection.serverName)}`;
      if (!nodes.some((n) => n.id === apiId)) {
        nodes.push({
          id: apiId,
          label: connection.serverName,
          type: 'ExternalAPI',
          riskWeight: 18,
          metadata: { transport: connection.transport },
        });
      }
    }
  }

  return {
    agentId: input.id,
    agentName: input.name,
    nodes,
    edges,
    rbacScopes: input.rbacScopes ?? input.capabilities,
    toolCapabilities,
    combinatorialRisks: [],
    effectiveRiskScore: 0,
    effectiveRiskLevel: 'LOW',
    privilegeEscalationDetected: false,
  };
}

/**
 * P0 EAG engine — merges RBAC declared scopes, tool capabilities, and combinatorial risk analysis.
 */
export function calculateEffectiveAuthority(
  agent: AgentAsset,
  fileContent?: string,
): EffectiveAuthorityResult {
  const input = agentAssetToInput(agent, fileContent);
  const authorityReport = detectEffectiveAuthority(agent, fileContent);

  input.rbacScopes = authorityReport.declaredScopes;

  let graph = buildGraphStructure(input);
  const classifiedTools = classifyAgentTools(input);
  const combinatorialRisks = detectCombinatorialRisks(input, classifiedTools);

  const baseScore = authorityReport.riskScore;
  const { score, level } = scoreCombinatorialRisks(combinatorialRisks, baseScore);

  graph = annotateGraphWithRisks(graph, combinatorialRisks);
  graph = {
    ...graph,
    effectiveRiskScore: score,
    effectiveRiskLevel: level,
    privilegeEscalationDetected:
      authorityReport.privilegeEscalationDetected || hasPrivilegeEscalation(combinatorialRisks),
  };

  if (graph.privilegeEscalationDetected && graph.effectiveRiskLevel === 'LOW') {
    graph.effectiveRiskLevel = resolveEffectiveRiskLevel(Math.max(score, 55));
  }

  return {
    graph,
    declaredScopes: authorityReport.declaredScopes,
    effectiveScopes: authorityReport.effectiveScopes,
    hiddenPermissions: authorityReport.hiddenPermissions,
  };
}

export function calculateEffectiveAuthorityFromInput(
  input: AgentAuthorityInput,
): EffectiveAuthorityResult {
  const agent: AgentAsset = {
    id: input.id,
    name: input.name,
    framework: input.framework as AgentAsset['framework'],
    sourceFile: 'inline',
    capabilities: input.capabilities as AgentAsset['capabilities'],
    riskLevel: 'MEDIUM',
    mcpConnections: input.mcpConnections.map((c) => ({
      serverName: c.serverName,
      transport: c.transport as 'stdio' | 'sse' | 'http' | undefined,
      tools: c.tools,
    })),
  };
  return calculateEffectiveAuthority(agent, input.fileContent);
}

const graphCache = new Map<string, EffectiveAuthorityResult>();

export function registerAuthorityGraph(
  agent: AgentAsset,
  fileContent?: string,
): EffectiveAuthorityResult {
  const result = calculateEffectiveAuthority(agent, fileContent);
  graphCache.set(agent.id, result);
  return result;
}

export function getCachedAuthorityGraph(agentId: string): EffectiveAuthorityResult | undefined {
  return graphCache.get(agentId);
}

export function listCachedAuthorityGraphs(): EffectiveAuthorityResult[] {
  return [...graphCache.values()];
}

export function resetAuthorityGraphCache(): void {
  graphCache.clear();
}
