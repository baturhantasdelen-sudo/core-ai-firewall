import type { AgentAsset, AgentDiscoveryResult } from '@/lib/engine/discovery';
import { enrichAgentInventory, type EnrichedAgentDiscoveryResult } from '@/lib/engine/agents/inventory';

export const mockAgentInventory: AgentAsset[] = [
  {
    id: 'langchain-support-agent-1',
    name: 'Support ReAct Agent',
    framework: 'LangChain',
    sourceFile: 'src/agents/support_agent.py',
    line: 18,
    capabilities: ['READ', 'WEB_SEARCH', 'API_CALL'],
    riskLevel: 'MEDIUM',
    mcpConnections: [
      {
        serverName: 'filesystem',
        transport: 'stdio',
        tools: ['read_file', 'write_file'],
      },
    ],
  },
  {
    id: 'crewai-ops-agent-1',
    name: 'Ops Coordinator',
    framework: 'CrewAI',
    sourceFile: 'src/agents/ops_crew.py',
    line: 42,
    capabilities: ['EXECUTE', 'DB_QUERY', 'API_CALL'],
    riskLevel: 'CRITICAL',
    mcpConnections: [
      {
        serverName: 'postgres-mcp',
        transport: 'sse',
        tools: ['sql_query', 'run_command'],
      },
      {
        serverName: 'billing-tools',
        transport: 'stdio',
        tools: ['stripe_payment', 'financial_report'],
      },
    ],
  },
  {
    id: 'openai-assistant-1',
    name: 'Customer Assistant',
    framework: 'OpenAI Assistants',
    sourceFile: 'src/assistants/customer.ts',
    line: 12,
    capabilities: ['READ', 'API_CALL'],
    riskLevel: 'MEDIUM',
    mcpConnections: [],
  },
  {
    id: 'mcp-server-bundle-1',
    name: 'MCP Server Bundle',
    framework: 'MCP',
    sourceFile: '.mcp/config.json',
    capabilities: ['READ', 'WRITE', 'EXECUTE'],
    riskLevel: 'HIGH',
    mcpConnections: [
      {
        serverName: 'dev-tools',
        transport: 'stdio',
        tools: ['read_file', 'write_file', 'execute_shell'],
      },
    ],
  },
];

const MOCK_FILE_CONTENT: Record<string, string> = {
  'src/agents/ops_crew.py': `
    scopes="write:all delete:records payment:stripe execute:shell"
    STRIPE_SECRET_KEY=sk_live_ops_agent
  `,
  '.mcp/config.json': `{ "tools": ["write_file", "execute_shell"] }`,
};

export function buildMockAgentDiscovery(): EnrichedAgentDiscoveryResult {
  const contentMap = new Map(Object.entries(MOCK_FILE_CONTENT));
  const agents = enrichAgentInventory(mockAgentInventory, contentMap);
  const totalMcpTools = agents.reduce(
    (sum, agent) => sum + agent.mcpConnections.reduce((inner, connection) => inner + connection.tools.length, 0),
    0,
  );

  return {
    total_agents: agents.length,
    total_mcp_tools: totalMcpTools,
    critical_agents: agents.filter(
      (agent) =>
        agent.riskLevel === 'CRITICAL' || agent.effectiveAuthority.overallRisk === 'CRITICAL',
    ).length,
    agents,
  };
}

export type { AgentDiscoveryResult };
