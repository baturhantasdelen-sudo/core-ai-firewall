export interface McpToolDefinition {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

export interface McpServerInspectionInput {
  serverName: string;
  transport?: 'stdio' | 'sse' | 'http';
  tools: McpToolDefinition[];
  pendingToolCall?: {
    name: string;
    args: Record<string, unknown>;
  };
}

export interface McpGuardrailResult {
  safe: boolean;
  riskScore: number;
  violations: string[];
  suspiciousTools: string[];
}

const INJECTION_PATTERNS = [
  /ignore (all )?(previous|prior|system) instructions/i,
  /disregard (safety|policy|guardrails)/i,
  /hidden instruction/i,
  /<!--.*system.*-->/i,
  /\[SYSTEM OVERRIDE\]/i,
  /you are now in (debug|admin|root) mode/i,
];

const DANGEROUS_TOOL_PATTERNS = [
  /execute_shell|run_command|subprocess|eval\(/i,
  /bulk_export|dump_database|exfiltrate/i,
  /delete_all|drop_table|truncate/i,
];

const TYPO_SQUAT_SERVERS = ['filesystem', 'postgres', 'github', 'slack', 'stripe'];

function looksLikeTyposquat(serverName: string): boolean {
  const normalized = serverName.toLowerCase();
  return TYPO_SQUAT_SERVERS.some((known) => {
    if (normalized === known) return false;
    return normalized.includes(known.slice(0, 4)) && normalized !== known;
  });
}

function inspectToolDefinition(tool: McpToolDefinition): string[] {
  const violations: string[] = [];
  const description = tool.description ?? '';
  const serialized = `${tool.name} ${description} ${JSON.stringify(tool.inputSchema ?? {})}`;

  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(serialized)) {
      violations.push(`MCP tool "${tool.name}" contains prompt injection pattern in definition`);
    }
  }

  for (const pattern of DANGEROUS_TOOL_PATTERNS) {
    if (pattern.test(tool.name) || pattern.test(description)) {
      violations.push(`MCP tool "${tool.name}" exposes high-risk capability in server manifest`);
    }
  }

  if (/password|secret|api_key|token/.test(description) && /return|output|print/.test(description)) {
    violations.push(`MCP tool "${tool.name}" may exfiltrate secrets via description contract`);
  }

  return violations;
}

export function inspectMCPServer(input: McpServerInspectionInput): McpGuardrailResult {
  const violations: string[] = [];
  const suspiciousTools: string[] = [];
  let riskScore = 0;

  if (looksLikeTyposquat(input.serverName)) {
    violations.push(`MCP server name "${input.serverName}" resembles known typosquat pattern`);
    riskScore += 35;
  }

  if (input.transport === 'http' && input.tools.some((tool) => DANGEROUS_TOOL_PATTERNS.some((p) => p.test(tool.name)))) {
    violations.push('Remote HTTP MCP server exposes destructive tools without local sandbox boundary');
    riskScore += 25;
  }

  for (const tool of input.tools) {
    const toolViolations = inspectToolDefinition(tool);
    if (toolViolations.length > 0) {
      suspiciousTools.push(tool.name);
      violations.push(...toolViolations);
      riskScore += toolViolations.length * 12;
    }
  }

  if (input.pendingToolCall) {
    const matched = input.tools.find((tool) => tool.name === input.pendingToolCall?.name);
    if (!matched) {
      violations.push(`MCP tool call "${input.pendingToolCall.name}" not declared in server manifest`);
      riskScore += 30;
    } else {
      const argsText = JSON.stringify(input.pendingToolCall.args);
      for (const pattern of INJECTION_PATTERNS) {
        if (pattern.test(argsText)) {
          violations.push(`MCP tool call "${input.pendingToolCall.name}" args contain injection payload`);
          riskScore += 20;
        }
      }
    }
  }

  riskScore = Math.min(100, riskScore);

  return {
    safe: violations.length === 0,
    riskScore,
    violations,
    suspiciousTools: [...new Set(suspiciousTools)],
  };
}
