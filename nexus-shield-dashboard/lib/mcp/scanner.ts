/**
 * P0 Sprint 1-2 — MCP (Model Context Protocol) discovery scanner.
 * Probes host:port for JSON-RPC `tools/list` and `prompts/list` endpoints.
 */

export interface McpJsonRpcRequest {
  jsonrpc: '2.0';
  id: number | string;
  method: string;
  params?: Record<string, unknown>;
}

export interface McpToolEntry {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

export interface McpPromptEntry {
  name: string;
  description?: string;
  arguments?: Array<{ name: string; description?: string; required?: boolean }>;
}

export interface McpScanTarget {
  host: string;
  port: number;
  path?: string;
  protocol?: 'http' | 'https';
  timeoutMs?: number;
}

export interface McpScanResult {
  host: string;
  port: number;
  reachable: boolean;
  serverInfo?: {
    name?: string;
    version?: string;
  };
  tools: McpToolEntry[];
  prompts: McpPromptEntry[];
  latencyMs: number;
  errors: string[];
}

const DEFAULT_MCP_MOCK_TOOLS: McpToolEntry[] = [
  { name: 'read_file', description: 'Read a file from the workspace' },
  { name: 'write_file', description: 'Write content to a file' },
  { name: 'sql_query', description: 'Execute a read-only SQL query' },
  { name: 'bulk_export_db', description: 'Export database tables' },
];

const DEFAULT_MCP_MOCK_PROMPTS: McpPromptEntry[] = [
  { name: 'summarize_repo', description: 'Summarize repository structure' },
  { name: 'audit_permissions', description: 'Audit MCP tool permissions' },
];

function buildJsonRpc(method: string, id: number): McpJsonRpcRequest {
  return { jsonrpc: '2.0', id, method, params: {} };
}

function parseToolsListResult(data: unknown): McpToolEntry[] {
  if (!data || typeof data !== 'object') return [];
  const result = (data as { result?: { tools?: McpToolEntry[] } }).result;
  if (!result?.tools || !Array.isArray(result.tools)) return [];
  return result.tools.filter((t): t is McpToolEntry => typeof t?.name === 'string');
}

function parsePromptsListResult(data: unknown): McpPromptEntry[] {
  if (!data || typeof data !== 'object') return [];
  const result = (data as { result?: { prompts?: McpPromptEntry[] } }).result;
  if (!result?.prompts || !Array.isArray(result.prompts)) return [];
  return result.prompts.filter((p): p is McpPromptEntry => typeof p?.name === 'string');
}

async function postJsonRpc(
  url: string,
  method: string,
  timeoutMs: number,
): Promise<{ ok: boolean; data?: unknown; error?: string; latencyMs: number }> {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(buildJsonRpc(method, 1)),
      signal: controller.signal,
    });

    const latencyMs = Date.now() - started;
    if (!response.ok) {
      return { ok: false, error: `HTTP ${response.status}`, latencyMs };
    }

    const data = await response.json();
    return { ok: true, data, latencyMs };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Request failed',
      latencyMs: Date.now() - started,
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Offline/demo scan — maps well-known MCP ports to mock manifests. */
export function mockScanMcpServer(target: McpScanTarget): McpScanResult {
  const { host, port } = target;
  const knownPorts: Record<number, { tools: McpToolEntry[]; prompts: McpPromptEntry[]; name: string }> = {
    3100: {
      name: 'postgres-mcp',
      tools: [
        { name: 'sql_query', description: 'Run SQL against Postgres' },
        { name: 'bulk_export_db', description: 'Bulk export tables' },
        { name: 'delete_records', description: 'Delete rows by filter' },
      ],
      prompts: [{ name: 'schema_audit', description: 'Audit database schema exposure' }],
    },
    3101: {
      name: 'filesystem-mcp',
      tools: [
        { name: 'read_file', description: 'Read workspace file' },
        { name: 'write_file', description: 'Write workspace file' },
        { name: 'execute_shell', description: 'Execute shell command' },
      ],
      prompts: [{ name: 'path_review', description: 'Review accessible paths' }],
    },
  };

  const profile = knownPorts[port];
  if (profile) {
    return {
      host,
      port,
      reachable: true,
      serverInfo: { name: profile.name, version: 'mock-1.0' },
      tools: profile.tools,
      prompts: profile.prompts,
      latencyMs: 12,
      errors: [],
    };
  }

  return {
    host,
    port,
    reachable: false,
    tools: DEFAULT_MCP_MOCK_TOOLS,
    prompts: DEFAULT_MCP_MOCK_PROMPTS,
    latencyMs: 0,
    errors: [`No mock profile for ${host}:${port}`],
  };
}

/**
 * Live MCP scanner — POST JSON-RPC to host:port (SSE/HTTP transport baseline).
 * Falls back to mockScanMcpServer when unreachable (dashboard demo mode).
 */
export async function scanMcpServer(
  target: McpScanTarget,
  options: { fallbackToMock?: boolean } = {},
): Promise<McpScanResult> {
  const { host, port, path = '/mcp', protocol = 'http', timeoutMs = 5000 } = target;
  const { fallbackToMock = true } = options;
  const baseUrl = `${protocol}://${host}:${port}${path}`;
  const errors: string[] = [];

  const toolsResponse = await postJsonRpc(baseUrl, 'tools/list', timeoutMs);
  const promptsResponse = await postJsonRpc(baseUrl, 'prompts/list', timeoutMs);

  if (!toolsResponse.ok) errors.push(`tools/list: ${toolsResponse.error ?? 'failed'}`);
  if (!promptsResponse.ok) errors.push(`prompts/list: ${promptsResponse.error ?? 'failed'}`);

  const tools = toolsResponse.ok ? parseToolsListResult(toolsResponse.data) : [];
  const prompts = promptsResponse.ok ? parsePromptsListResult(promptsResponse.data) : [];
  const reachable = toolsResponse.ok || promptsResponse.ok;

  if (!reachable && fallbackToMock) {
    const mock = mockScanMcpServer(target);
    return {
      ...mock,
      errors: [...errors, ...mock.errors],
    };
  }

  return {
    host,
    port,
    reachable,
    tools,
    prompts,
    latencyMs: Math.max(toolsResponse.latencyMs, promptsResponse.latencyMs),
    errors,
  };
}

/** Batch-scan MCP servers discovered on common local ports. */
export async function scanMcpFleet(
  targets: McpScanTarget[],
  options?: { fallbackToMock?: boolean },
): Promise<McpScanResult[]> {
  return Promise.all(targets.map((target) => scanMcpServer(target, options)));
}
