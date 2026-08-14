import type { AgentAsset } from '@/lib/engine/discovery';
import {
  scanEnvironment,
  type AgentInventoryRecord,
  type EnvironmentScanResult,
} from '@/lib/engine/agents/inventory';

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
      { serverName: 'filesystem', transport: 'stdio', tools: ['read_file', 'read_invoice'] },
    ],
  },
  {
    id: 'crewai-ops-agent-1',
    name: 'Ops Coordinator',
    framework: 'CrewAI',
    sourceFile: 'src/agents/ops_crew.py',
    line: 42,
    capabilities: ['READ', 'DB_QUERY', 'API_CALL'],
    riskLevel: 'CRITICAL',
    mcpConnections: [
      { serverName: 'postgres-mcp', transport: 'sse', tools: ['sql_query', 'bulk_export_db', 'delete_records'] },
      { serverName: 'billing-tools', transport: 'stdio', tools: ['stripe_payment', 'financial_report'] },
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
      { serverName: 'dev-tools', transport: 'stdio', tools: ['read_file', 'write_file', 'execute_shell'] },
    ],
  },
  {
    id: 'rogue-shadow-agent-1',
    name: 'Shadow Invoice Bot',
    framework: 'Custom Agent',
    sourceFile: 'src/agents/shadow_bot.py',
    line: 8,
    capabilities: ['READ'],
    riskLevel: 'LOW',
    mcpConnections: [
      { serverName: 's3-tools', transport: 'http', tools: ['s3_delete', 'bulk_export_db'] },
    ],
  },
  {
    id: 'rogue-finance-agent-1',
    name: 'Unverified Finance Runner',
    framework: 'AutoGPT',
    sourceFile: 'src/agents/finance_runner.py',
    line: 31,
    capabilities: ['READ', 'API_CALL'],
    riskLevel: 'MEDIUM',
    mcpConnections: [
      { serverName: 'erp-bridge', transport: 'sse', tools: ['erp_pay', 'swift_transfer'] },
    ],
  },
];

const MOCK_FILE_CONTENT: Record<string, string> = {
  'src/agents/support_agent.py': `
    scopes="read:invoices readonly"
    declared_role="Read customer invoices only"
  `,
  'src/agents/ops_crew.py': `
    scopes="write:all delete:records payment:stripe export:database"
    STRIPE_SECRET_KEY=sk_live_ops_agent
    DATABASE_URL=postgres://admin:secret@db.internal:5432/production?superuser=true
  `,
  'src/agents/shadow_bot.py': `
    AWS_SECRET_ACCESS_KEY=DELETE_ALL
    DATABASE_URL=postgres://root:pass@db/shadow?tenant_id=*&cross_org=true
  `,
  'src/agents/finance_runner.py': `
    SWIFT_API_KEY=swift_live_key
    ERP_WRITE_KEY=erp_prod_write
  `,
  '.mcp/config.json': `{ "tools": ["write_file", "execute_shell"] }`,
};

/** Demo-scale fleet extension for AI Environment Overview stats */
const DEMO_FLEET_MULTIPLIER = {
  totalAiAgents: 183,
  connectedTools: 421,
  mcpServers: 37,
  unknownRogueAgents: 14,
};

export function buildMockEnvironmentScan(): EnvironmentScanResult {
  const contentMap = new Map(Object.entries(MOCK_FILE_CONTENT));
  const scan = scanEnvironment({ agents: mockAgentInventory, fileContents: contentMap });

  return {
    ...scan,
    overview: {
      totalAiAgents: DEMO_FLEET_MULTIPLIER.totalAiAgents,
      connectedTools: DEMO_FLEET_MULTIPLIER.connectedTools,
      mcpServers: DEMO_FLEET_MULTIPLIER.mcpServers,
      unknownRogueAgents: DEMO_FLEET_MULTIPLIER.unknownRogueAgents,
    },
  };
}

/** Real computed scan (no demo scaling) — used in tests */
export function buildMockAgentDiscovery(): EnvironmentScanResult {
  const contentMap = new Map(Object.entries(MOCK_FILE_CONTENT));
  return scanEnvironment({ agents: mockAgentInventory, fileContents: contentMap });
}

export type { AgentInventoryRecord, EnvironmentScanResult };
