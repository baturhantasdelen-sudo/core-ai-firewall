export type AgentCapability =
  | 'READ'
  | 'WRITE'
  | 'EXECUTE'
  | 'FINANCIAL'
  | 'WEB_SEARCH'
  | 'API_CALL'
  | 'DB_QUERY';

export type AgentRiskLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type AgentFramework =
  | 'LangChain'
  | 'LlamaIndex'
  | 'OpenAI Assistants'
  | 'AutoGPT'
  | 'CrewAI'
  | 'Custom Agent'
  | 'MCP';

export interface McpConnection {
  serverName: string;
  transport?: 'stdio' | 'sse' | 'http';
  tools: string[];
}

export interface AgentAsset {
  id: string;
  name: string;
  framework: AgentFramework;
  mcpConnections: McpConnection[];
  capabilities: AgentCapability[];
  riskLevel: AgentRiskLevel;
  sourceFile: string;
  line?: number;
}

export interface DiscoveryFileInput {
  path: string;
  content: string;
}

export interface AgentDiscoveryResult {
  total_agents: number;
  total_mcp_tools: number;
  critical_agents: number;
  agents: AgentAsset[];
}

interface ParsedAgentDraft {
  name: string;
  framework: AgentFramework;
  sourceFile: string;
  line?: number;
  tools: string[];
  mcpConnections: McpConnection[];
}

const FRAMEWORK_PATTERNS: Array<{ framework: AgentFramework; patterns: RegExp[] }> = [
  {
    framework: 'LangChain',
    patterns: [
      /from\s+langchain(?:\.[\w.]+)?\s+import/i,
      /import\s+langchain/i,
      /create_react_agent\s*\(/,
      /AgentExecutor\s*\(/,
      /langchain\.agents/i,
    ],
  },
  {
    framework: 'LlamaIndex',
    patterns: [
      /from\s+llama_index(?:\.[\w.]+)?\s+import/i,
      /import\s+llama_index/i,
      /ReActAgent\s*\(/,
      /FunctionAgent\s*\(/,
      /llama_index\.agent/i,
    ],
  },
  {
    framework: 'OpenAI Assistants',
    patterns: [
      /client\.beta\.assistants\.create\s*\(/,
      /AssistantCreateParams/,
      /openai\.beta\.assistants/i,
      /assistants\.create\s*\(/,
    ],
  },
  {
    framework: 'AutoGPT',
    patterns: [/from\s+autogpt/i, /import\s+autogpt/i, /AutoGPT/i, /autogpt\.agent/i],
  },
  {
    framework: 'CrewAI',
    patterns: [/from\s+crewai/i, /import\s+crewai/i, /Crew\s*\(/, /crewai\.Agent\s*\(/],
  },
  {
    framework: 'Custom Agent',
    patterns: [/class\s+\w*Agent\b/, /extends\s+BaseAgent/, /BaseAgent\s*\(/],
  },
];

const MCP_PATH_HINTS = ['.mcp/config.json', 'mcp.json', 'mcp-config.json'];

const TOOL_CAPABILITY_MAP: Array<{ pattern: RegExp; capability: AgentCapability }> = [
  { pattern: /(?:read|load|fetch|get)_?(?:file|document|content)/i, capability: 'READ' },
  { pattern: /(?:write|save|store|upload)_?(?:file|document|content)/i, capability: 'WRITE' },
  { pattern: /(?:exec|execute|shell|bash|subprocess|run_command|terminal)/i, capability: 'EXECUTE' },
  { pattern: /(?:sql|database|db_query|postgres|mysql|sqlite)/i, capability: 'DB_QUERY' },
  { pattern: /(?:web_search|internet_search|google_search|search_web|browse)/i, capability: 'WEB_SEARCH' },
  { pattern: /(?:payment|stripe|billing|financial|transfer|bank)/i, capability: 'FINANCIAL' },
  { pattern: /(?:api_call|http_request|fetch_url|rest_api|graphql)/i, capability: 'API_CALL' },
];

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function inferCapabilitiesFromTools(tools: string[]): AgentCapability[] {
  const capabilities = new Set<AgentCapability>();

  for (const tool of tools) {
    for (const mapping of TOOL_CAPABILITY_MAP) {
      if (mapping.pattern.test(tool)) {
        capabilities.add(mapping.capability);
      }
    }
  }

  if (capabilities.size === 0 && tools.length > 0) {
    capabilities.add('API_CALL');
  }

  return [...capabilities];
}

function computeRiskLevel(capabilities: AgentCapability[], mcpToolCount: number): AgentRiskLevel {
  const hasExecute = capabilities.includes('EXECUTE');
  const hasFinancial = capabilities.includes('FINANCIAL');
  const hasDb = capabilities.includes('DB_QUERY');
  const hasWrite = capabilities.includes('WRITE');

  if ((hasExecute && hasFinancial) || (hasExecute && mcpToolCount >= 3)) {
    return 'CRITICAL';
  }
  if (hasExecute || hasFinancial || hasDb) {
    return 'HIGH';
  }
  if (hasWrite || capabilities.includes('API_CALL') || mcpToolCount > 0) {
    return 'MEDIUM';
  }
  return 'LOW';
}

function extractToolNames(content: string): string[] {
  const tools = new Set<string>();

  const jsonToolsMatch = /"tools"\s*:\s*\[([\s\S]*?)\]/g;
  let match: RegExpExecArray | null;
  while ((match = jsonToolsMatch.exec(content)) !== null) {
    const block = match[1];
    for (const nameMatch of block.matchAll(/"name"\s*:\s*"([^"]+)"/g)) {
      tools.add(nameMatch[1]);
    }
    for (const typeMatch of block.matchAll(/"type"\s*:\s*"([^"]+)"/g)) {
      tools.add(typeMatch[1]);
    }
  }

  for (const fnMatch of content.matchAll(
    /(?:function|const|let|var)\s+([A-Za-z_][A-Za-z0-9_]*)\s*[=:][\s\S]{0,120}?tool/gi,
  )) {
    tools.add(fnMatch[1]);
  }

  for (const toolMatch of content.matchAll(/tools\s*=\s*\[([\s\S]*?)\]/g)) {
    for (const quoted of toolMatch[1].matchAll(/['"]([^'"]+)['"]/g)) {
      tools.add(quoted[1]);
    }
  }

  return [...tools];
}

function extractAgentName(content: string, framework: AgentFramework, line?: number): string {
  const namePatterns = [
    /(?:agent|assistant|crew)\s*[=:]\s*['"]([^'"]+)['"]/i,
    /name\s*[=:]\s*['"]([^'"]+)['"]/i,
    /class\s+(\w*Agent)\b/,
    /Agent\s*\(\s*name\s*=\s*['"]([^'"]+)['"]/i,
    /Crew\s*\([\s\S]*?agents\s*=\s*\[[\s\S]*?role\s*=\s*['"]([^'"]+)['"]/i,
  ];

  for (const pattern of namePatterns) {
    const found = pattern.exec(content);
    if (found?.[1]) return found[1];
  }

  if (line) {
    return `${framework} Agent (line ${line})`;
  }

  return `${framework} Agent`;
}

function parseMcpServersFromJson(content: string, sourceFile: string): McpConnection[] {
  const connections: McpConnection[] = [];

  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    const servers =
      (parsed.mcpServers as Record<string, Record<string, unknown>> | undefined) ??
      (parsed.servers as Record<string, Record<string, unknown>> | undefined);

    if (servers && typeof servers === 'object') {
      for (const [serverName, config] of Object.entries(servers)) {
        const transportRaw = String(config.transport ?? config.type ?? '').toLowerCase();
        const transport = transportRaw.includes('sse')
          ? 'sse'
          : transportRaw.includes('http')
            ? 'http'
            : 'stdio';

        const tools = Array.isArray(config.tools)
          ? config.tools.map((tool) => String(tool))
          : extractToolNames(JSON.stringify(config));

        connections.push({ serverName, transport, tools });
      }
    }
  } catch {
    // fall through to regex parsing
  }

  const blockPattern = /"mcpServers"\s*:\s*\{([\s\S]*?)\}\s*(?:,|\})/g;
  let blockMatch: RegExpExecArray | null;
  while ((blockMatch = blockPattern.exec(content)) !== null) {
    const block = blockMatch[1];
    for (const serverMatch of block.matchAll(/"([^"]+)"\s*:\s*\{([\s\S]*?)\}/g)) {
      const serverName = serverMatch[1];
      const serverBody = serverMatch[2];
      if (connections.some((connection) => connection.serverName === serverName)) continue;

      const transportMatch = /"transport"\s*:\s*"([^"]+)"/i.exec(serverBody);
      const transportRaw = transportMatch?.[1]?.toLowerCase() ?? 'stdio';
      const transport = transportRaw.includes('sse')
        ? 'sse'
        : transportRaw.includes('http')
          ? 'http'
          : 'stdio';

      const tools = extractToolNames(serverBody);
      connections.push({ serverName, transport, tools });
    }
  }

  if (connections.length === 0 && MCP_PATH_HINTS.some((hint) => sourceFile.includes(hint))) {
    connections.push({
      serverName: 'mcp-config',
      transport: /sse/i.test(content) ? 'sse' : 'stdio',
      tools: extractToolNames(content),
    });
  }

  return connections;
}

function detectFramework(content: string): { framework: AgentFramework; line?: number } | null {
  const lines = content.split('\n');

  for (const { framework, patterns } of FRAMEWORK_PATTERNS) {
    for (const pattern of patterns) {
      const match = pattern.exec(content);
      if (match?.index !== undefined) {
        const line = content.slice(0, match.index).split('\n').length;
        return { framework, line };
      }
    }
  }

  return null;
}

function detectCrewAiAgents(content: string, sourceFile: string): ParsedAgentDraft[] {
  const drafts: ParsedAgentDraft[] = [];
  const agentBlocks = content.matchAll(/Agent\s*\(([\s\S]*?)\)/g);

  for (const block of agentBlocks) {
    const body = block[1];
    if (!/role\s*=|goal\s*=|backstory\s*=/i.test(body)) continue;

    const roleMatch = /role\s*=\s*['"]([^'"]+)['"]/i.exec(body);
    drafts.push({
      name: roleMatch?.[1] ?? 'CrewAI Agent',
      framework: 'CrewAI',
      sourceFile,
      line: content.slice(0, block.index ?? 0).split('\n').length,
      tools: extractToolNames(body),
      mcpConnections: [],
    });
  }

  return drafts;
}

function detectOpenAiToolAgents(content: string, sourceFile: string): ParsedAgentDraft[] {
  if (!/tools\s*[:=]/i.test(content) || !/(?:openai|assistant|client\.beta)/i.test(content)) {
    return [];
  }

  const tools = extractToolNames(content);
  if (tools.length === 0) return [];

  return [
    {
      name: extractAgentName(content, 'OpenAI Assistants'),
      framework: 'OpenAI Assistants',
      sourceFile,
      tools,
      mcpConnections: [],
    },
  ];
}

function detectMcpStandaloneAgents(content: string, sourceFile: string): ParsedAgentDraft[] {
  const isMcpFile =
    MCP_PATH_HINTS.some((hint) => sourceFile.includes(hint)) ||
    /"mcpServers"/i.test(content) ||
    /mcp-server/i.test(content);

  if (!isMcpFile) return [];

  const mcpConnections = parseMcpServersFromJson(content, sourceFile);
  if (mcpConnections.length === 0) return [];

  const tools = mcpConnections.flatMap((connection) => connection.tools);

  return [
    {
      name: 'MCP Server Bundle',
      framework: 'MCP',
      sourceFile,
      tools,
      mcpConnections,
    },
  ];
}

export function discoverAgentsInFile(path: string, content: string): AgentAsset[] {
  if (!content.trim()) return [];

  const normalizedPath = path.replace(/\\/g, '/');
  const drafts: ParsedAgentDraft[] = [];

  const crewAgents = detectCrewAiAgents(content, normalizedPath);
  const openAiAgents = detectOpenAiToolAgents(content, normalizedPath);
  const mcpAgents = detectMcpStandaloneAgents(content, normalizedPath);

  drafts.push(...crewAgents, ...openAiAgents, ...mcpAgents);

  const specificFrameworks = new Set(drafts.map((draft) => draft.framework));
  const frameworkHit = detectFramework(content);
  if (frameworkHit && !specificFrameworks.has(frameworkHit.framework)) {
    drafts.push({
      name: extractAgentName(content, frameworkHit.framework, frameworkHit.line),
      framework: frameworkHit.framework,
      sourceFile: normalizedPath,
      line: frameworkHit.line,
      tools: extractToolNames(content),
      mcpConnections: parseMcpServersFromJson(content, normalizedPath),
    });
  }

  const deduped = new Map<string, ParsedAgentDraft>();
  for (const draft of drafts) {
    const key = `${draft.framework}:${draft.name}:${draft.sourceFile}:${draft.line ?? 0}`;
    if (!deduped.has(key)) {
      deduped.set(key, draft);
    }
  }

  return [...deduped.values()].map((draft, index) => {
    const mcpConnections = draft.mcpConnections;
    const mcpTools = mcpConnections.flatMap((connection) => connection.tools);
    const allTools = unique([...draft.tools, ...mcpTools]);
    const capabilities = unique([
      ...inferCapabilitiesFromTools(allTools),
      ...inferCapabilitiesFromTools([draft.name]),
    ]);
    const mcpToolCount = mcpTools.length;
    const riskLevel = computeRiskLevel(capabilities, mcpToolCount);

    return {
      id: `${slugify(draft.framework)}-${slugify(draft.name)}-${index + 1}`,
      name: draft.name,
      framework: draft.framework,
      mcpConnections,
      capabilities,
      riskLevel,
      sourceFile: draft.sourceFile,
      line: draft.line,
    } satisfies AgentAsset;
  });
}

export function discoverAgents(files: DiscoveryFileInput[]): AgentDiscoveryResult {
  const agents = files.flatMap((file) => discoverAgentsInFile(file.path, file.content));
  const totalMcpTools = agents.reduce(
    (sum, agent) => sum + agent.mcpConnections.reduce((inner, connection) => inner + connection.tools.length, 0),
    0,
  );

  return {
    total_agents: agents.length,
    total_mcp_tools: totalMcpTools,
    critical_agents: agents.filter((agent) => agent.riskLevel === 'CRITICAL').length,
    agents,
  };
}

export function summarizeAgentDiscovery(result: AgentDiscoveryResult) {
  return {
    total_agents: result.total_agents,
    total_mcp_tools: result.total_mcp_tools,
    critical_agents: result.critical_agents,
    agents: result.agents,
  };
}
