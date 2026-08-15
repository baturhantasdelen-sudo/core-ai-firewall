import { discoverAgents, type AgentAsset, type AgentFramework } from '@/lib/engine/discovery';
import {
  summarizeDiscovery,
  type AgentInventory,
  type AgentInventoryStatus,
  type AgentInventoryType,
  type DiscoveryScanResult,
  type NetworkFlowLog,
} from '@/lib/discovery/types';

export interface DiscoveryServiceOptions {
  /** Raw eBPF / VPC flow log lines (JSON or pipe-delimited). */
  networkLogs?: string[];
  /** Repository file snapshots for static agent discovery. */
  codeFiles?: Array<{ path: string; content: string }>;
  /** Include curated mock fleet for demo dashboards. */
  includeMockBaseline?: boolean;
}

const MOCK_BASELINE: AgentInventory[] = [
  {
    id: 'disc-langchain-support-1',
    name: 'Support ReAct Agent',
    type: 'LANGCHAIN',
    status: 'ACTIVE',
    endpoint: '10.0.4.12:8080',
    detectedAt: '2026-08-15T18:22:11.000Z',
    riskScore: 42,
    mcpToolsCount: 2,
  },
  {
    id: 'disc-autogen-ops-1',
    name: 'Ops Coordinator',
    type: 'AUTOGEN',
    status: 'ACTIVE',
    endpoint: '10.0.4.18:9090',
    detectedAt: '2026-08-15T18:24:03.000Z',
    riskScore: 88,
    mcpToolsCount: 5,
  },
  {
    id: 'disc-mcp-postgres-1',
    name: 'postgres-mcp',
    type: 'MCP_SERVER',
    status: 'ACTIVE',
    endpoint: '127.0.0.1:3100',
    detectedAt: '2026-08-15T18:25:44.000Z',
    riskScore: 76,
    mcpToolsCount: 8,
  },
  {
    id: 'disc-mcp-filesystem-1',
    name: 'filesystem-mcp',
    type: 'MCP_SERVER',
    status: 'ACTIVE',
    endpoint: '127.0.0.1:3101',
    detectedAt: '2026-08-15T18:25:46.000Z',
    riskScore: 61,
    mcpToolsCount: 4,
  },
  {
    id: 'disc-custom-finance-1',
    name: 'Finance Workflow Runner',
    type: 'CUSTOM_AGENT',
    status: 'ACTIVE',
    endpoint: '10.0.6.44:7001',
    detectedAt: '2026-08-15T18:31:02.000Z',
    riskScore: 55,
    mcpToolsCount: 3,
  },
  {
    id: 'disc-shadow-invoice-1',
    name: 'Shadow Invoice Bot',
    type: 'SHADOW_AGENT',
    status: 'QUARANTINED',
    endpoint: '10.0.9.77:4444',
    detectedAt: '2026-08-15T19:02:18.000Z',
    riskScore: 91,
    mcpToolsCount: 2,
  },
  {
    id: 'disc-shadow-crawler-1',
    name: 'Unknown LLM Proxy',
    type: 'SHADOW_AGENT',
    status: 'ACTIVE',
    endpoint: '192.168.88.12:11434',
    detectedAt: '2026-08-15T19:08:55.000Z',
    riskScore: 73,
    mcpToolsCount: 0,
  },
];

function frameworkToType(framework: AgentFramework): AgentInventoryType {
  switch (framework) {
    case 'LangChain':
    case 'LlamaIndex':
      return 'LANGCHAIN';
    case 'AutoGPT':
    case 'CrewAI':
      return 'AUTOGEN';
    case 'MCP':
      return 'MCP_SERVER';
    case 'Custom Agent':
      return 'CUSTOM_AGENT';
    default:
      return 'CUSTOM_AGENT';
  }
}

function riskLevelToScore(level: AgentAsset['riskLevel']): number {
  switch (level) {
    case 'CRITICAL':
      return 92;
    case 'HIGH':
      return 78;
    case 'MEDIUM':
      return 52;
    default:
      return 28;
  }
}

function assetToInventory(asset: AgentAsset, endpoint: string): AgentInventory {
  const mcpToolsCount = asset.mcpConnections.reduce((sum, c) => sum + c.tools.length, 0);
  const isShadow =
    asset.name.toLowerCase().includes('shadow') ||
    asset.sourceFile.toLowerCase().includes('shadow') ||
    asset.riskLevel === 'LOW' && asset.framework === 'Custom Agent';

  return {
    id: `code-${asset.id}`,
    name: asset.name,
    type: isShadow ? 'SHADOW_AGENT' : frameworkToType(asset.framework),
    status: isShadow ? 'QUARANTINED' : 'ACTIVE',
    endpoint,
    detectedAt: new Date().toISOString(),
    riskScore: riskLevelToScore(asset.riskLevel),
    mcpToolsCount,
  };
}

function parseNetworkLogLine(line: string): NetworkFlowLog | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  try {
    const json = JSON.parse(trimmed) as Partial<NetworkFlowLog>;
    if (json.dstPort && json.dstIp) {
      return {
        timestamp: json.timestamp ?? new Date().toISOString(),
        srcIp: json.srcIp ?? '0.0.0.0',
        dstIp: json.dstIp,
        dstPort: json.dstPort,
        protocol: json.protocol ?? 'TCP',
        bytes: json.bytes ?? 0,
        processName: json.processName,
        userAgent: json.userAgent,
        payloadHint: json.payloadHint,
      };
    }
  } catch {
    // pipe-delimited: ts|src|dst|port|proto|process|hint
    const parts = trimmed.split('|');
    if (parts.length >= 4) {
      const dstPort = Number.parseInt(parts[3] ?? '', 10);
      if (!Number.isNaN(dstPort)) {
        return {
          timestamp: parts[0] ?? new Date().toISOString(),
          srcIp: parts[1] ?? '0.0.0.0',
          dstIp: parts[2] ?? '0.0.0.0',
          dstPort,
          protocol: (parts[4]?.toUpperCase() === 'UDP' ? 'UDP' : 'TCP') as NetworkFlowLog['protocol'],
          bytes: 0,
          processName: parts[5],
          payloadHint: parts[6],
        };
      }
    }
  }

  return null;
}

function inferAgentFromFlow(flow: NetworkFlowLog): AgentInventory | null {
  const hint = `${flow.processName ?? ''} ${flow.userAgent ?? ''} ${flow.payloadHint ?? ''}`.toLowerCase();
  const endpoint = `${flow.dstIp}:${flow.dstPort}`;

  if (/mcp|tools\/list|json-rpc/.test(hint) || [3100, 3101, 8080, 11434].includes(flow.dstPort)) {
    const isMcp = /mcp|tools\/list|json-rpc/.test(hint) || flow.dstPort === 3100 || flow.dstPort === 3101;
    if (isMcp) {
      return {
        id: `net-mcp-${flow.dstIp}-${flow.dstPort}`,
        name: flow.processName ?? `mcp-${flow.dstPort}`,
        type: 'MCP_SERVER',
        status: 'ACTIVE',
        endpoint,
        detectedAt: flow.timestamp,
        riskScore: 68,
        mcpToolsCount: /tools\/list/.test(hint) ? 6 : 3,
      };
    }
  }

  if (/langchain|llamaindex|react_agent/.test(hint)) {
    return {
      id: `net-langchain-${flow.srcIp}-${flow.dstPort}`,
      name: flow.processName ?? 'LangChain Runtime',
      type: 'LANGCHAIN',
      status: 'ACTIVE',
      endpoint,
      detectedAt: flow.timestamp,
      riskScore: 45,
      mcpToolsCount: 1,
    };
  }

  if (/autogen|crewai|autogpt/.test(hint)) {
    return {
      id: `net-autogen-${flow.srcIp}-${flow.dstPort}`,
      name: flow.processName ?? 'AutoGen Runtime',
      type: 'AUTOGEN',
      status: 'ACTIVE',
      endpoint,
      detectedAt: flow.timestamp,
      riskScore: 72,
      mcpToolsCount: 2,
    };
  }

  if (/ollama|openai|anthropic|shadow|unknown/.test(hint) || flow.dstPort === 11434) {
    return {
      id: `net-shadow-${flow.dstIp}-${flow.dstPort}`,
      name: flow.processName ?? 'Unknown AI Endpoint',
      type: 'SHADOW_AGENT',
      status: 'ACTIVE',
      endpoint,
      detectedAt: flow.timestamp,
      riskScore: 80,
      mcpToolsCount: 0,
    };
  }

  return null;
}

export function detectAgentsFromNetworkLogs(logs: string[]): AgentInventory[] {
  const byEndpoint = new Map<string, AgentInventory>();

  for (const line of logs) {
    const flow = parseNetworkLogLine(line);
    if (!flow) continue;
    const agent = inferAgentFromFlow(flow);
    if (!agent) continue;
    byEndpoint.set(agent.endpoint, agent);
  }

  return [...byEndpoint.values()];
}

export function detectAgentsFromCode(
  files: Array<{ path: string; content: string }>,
): AgentInventory[] {
  const { agents: assets } = discoverAgents(files);
  return assets.map((asset, index) =>
    assetToInventory(asset, `repo://${asset.sourceFile}:${index}`),
  );
}

function mergeInventories(...lists: AgentInventory[][]): AgentInventory[] {
  const merged = new Map<string, AgentInventory>();
  for (const list of lists) {
    for (const agent of list) {
      const key = `${agent.type}:${agent.name}:${agent.endpoint}`;
      if (!merged.has(key)) {
        merged.set(key, agent);
      }
    }
  }
  return [...merged.values()].sort((a, b) => b.riskScore - a.riskScore);
}

export function runDiscoveryScan(options: DiscoveryServiceOptions = {}): DiscoveryScanResult {
  const {
    networkLogs = [],
    codeFiles = [],
    includeMockBaseline = true,
  } = options;

  const fromNetwork = detectAgentsFromNetworkLogs(networkLogs);
  const fromCode = codeFiles.length > 0 ? detectAgentsFromCode(codeFiles) : [];
  const fromMock = includeMockBaseline ? MOCK_BASELINE : [];

  const agents = mergeInventories(fromMock, fromNetwork, fromCode);
  const hasNetwork = fromNetwork.length > 0;
  const hasCode = fromCode.length > 0;

  let source: DiscoveryScanResult['source'] = 'mock';
  if (hasNetwork && hasCode) source = 'hybrid';
  else if (hasNetwork) source = 'network';
  else if (hasCode && !includeMockBaseline) source = 'hybrid';

  return {
    agents,
    summary: summarizeDiscovery(agents),
    scannedAt: new Date().toISOString(),
    source,
  };
}

/** Demo scan with mock baseline + sample eBPF/network observations. */
export function buildMockDiscoveryScan(): DiscoveryScanResult {
  const sampleLogs = [
    JSON.stringify({
      timestamp: '2026-08-15T19:10:01.000Z',
      srcIp: '10.0.4.22',
      dstIp: '127.0.0.1',
      dstPort: 3100,
      protocol: 'TCP',
      processName: 'postgres-mcp',
      payloadHint: 'json-rpc tools/list',
    }),
    JSON.stringify({
      timestamp: '2026-08-15T19:11:44.000Z',
      srcIp: '10.0.9.55',
      dstIp: '192.168.88.12',
      dstPort: 11434,
      protocol: 'TCP',
      processName: 'ollama-proxy',
      userAgent: 'unknown-llm-client',
      payloadHint: 'shadow inference',
    }),
  ];

  return runDiscoveryScan({
    networkLogs: sampleLogs,
    includeMockBaseline: true,
  });
}

export function filterAgentInventory(
  agents: AgentInventory[],
  query: {
    search?: string;
    type?: AgentInventoryType | 'ALL';
    status?: AgentInventoryStatus | 'ALL';
    minRisk?: number;
  },
): AgentInventory[] {
  const search = query.search?.trim().toLowerCase() ?? '';

  return agents.filter((agent) => {
    if (query.type && query.type !== 'ALL' && agent.type !== query.type) return false;
    if (query.status && query.status !== 'ALL' && agent.status !== query.status) return false;
    if (query.minRisk !== undefined && agent.riskScore < query.minRisk) return false;
    if (!search) return true;
    return (
      agent.name.toLowerCase().includes(search) ||
      agent.endpoint.toLowerCase().includes(search) ||
      agent.type.toLowerCase().includes(search)
    );
  });
}
