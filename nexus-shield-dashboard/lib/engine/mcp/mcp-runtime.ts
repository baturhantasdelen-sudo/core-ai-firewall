export type McpRuntimeDecision = 'ALLOW' | 'BLOCK' | 'REQUIRE_APPROVAL' | 'ISOLATE';

export type McpControlDimension = 'IDENTITY' | 'PERMISSIONS' | 'NETWORK' | 'DATA';

export interface McpRuntimePayload {
  args?: Record<string, unknown>;
  transport?: 'stdio' | 'sse' | 'http';
  declaredTools?: string[];
  agentCapabilities?: string[];
  serverIdentity?: string;
}

export interface McpDimensionViolation {
  dimension: McpControlDimension;
  reason: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface McpRuntimeEvaluation {
  decision: McpRuntimeDecision;
  mcpServerId: string;
  toolName: string;
  riskScore: number;
  violations: McpDimensionViolation[];
  dimensionsChecked: McpControlDimension[];
}

const TRUSTED_SERVER_IDENTITIES = new Set([
  'postgres-mcp',
  'github-mcp',
  'filesystem-mcp',
  'slack-mcp',
  'stripe-mcp',
]);

const BLOCKED_NETWORK_TARGETS = [
  /evil\.exfil/i,
  /pastebin\.com/i,
  /ngrok\.io/i,
  /requestbin/i,
  /webhook\.site/i,
];

const HIGH_RISK_TOOLS = [
  /execute_shell|run_command|subprocess|eval\(/i,
  /bulk_export|dump_database|exfiltrate|drop_table/i,
  /delete_all|truncate|purge_all/i,
];

const DATA_EXFIL_PATTERNS = [
  /password|secret|api_key|token|credential/i,
  /customer_data|pii|ssn|credit_card/i,
];

function inspectIdentity(
  mcpServerId: string,
  payload: McpRuntimePayload,
): McpDimensionViolation[] {
  const violations: McpDimensionViolation[] = [];
  const identity = payload.serverIdentity ?? mcpServerId;

  if (/file[sy]stem|postgr[e]?s|github|slack|stripe/i.test(mcpServerId) && !TRUSTED_SERVER_IDENTITIES.has(identity)) {
    const known = [...TRUSTED_SERVER_IDENTITIES].find((trusted) =>
      mcpServerId.toLowerCase().includes(trusted.replace('-mcp', '').slice(0, 4)),
    );
    if (known && identity !== known) {
      violations.push({
        dimension: 'IDENTITY',
        reason: `MCP server "${mcpServerId}" identity mismatch — possible typosquat (expected ${known})`,
        severity: 'HIGH',
      });
    }
  }

  if (/shadow|rogue|unknown|temp_/i.test(mcpServerId)) {
    violations.push({
      dimension: 'IDENTITY',
      reason: `Unregistered MCP server identity: ${mcpServerId}`,
      severity: 'CRITICAL',
    });
  }

  return violations;
}

function inspectPermissions(
  toolName: string,
  payload: McpRuntimePayload,
): McpDimensionViolation[] {
  const violations: McpDimensionViolation[] = [];
  const declared = new Set((payload.declaredTools ?? []).map((tool) => tool.toLowerCase()));
  const granted = new Set((payload.agentCapabilities ?? []).map((cap) => cap.toUpperCase()));

  if (declared.size > 0 && !declared.has(toolName.toLowerCase())) {
    violations.push({
      dimension: 'PERMISSIONS',
      reason: `Tool "${toolName}" not declared in MCP server manifest`,
      severity: 'HIGH',
    });
  }

  if (/bulk_export|dump_db|drop_table|execute_shell/.test(toolName) && !granted.has('DB_QUERY') && !granted.has('EXECUTE')) {
    violations.push({
      dimension: 'PERMISSIONS',
      reason: `Agent lacks capability for high-risk MCP tool "${toolName}"`,
      severity: 'CRITICAL',
    });
  }

  if (/stripe|payment|transfer/.test(toolName) && !granted.has('FINANCIAL')) {
    violations.push({
      dimension: 'PERMISSIONS',
      reason: `Financial MCP tool "${toolName}" invoked without FINANCIAL capability`,
      severity: 'HIGH',
    });
  }

  return violations;
}

function inspectNetwork(
  toolName: string,
  payload: McpRuntimePayload,
): McpDimensionViolation[] {
  const violations: McpDimensionViolation[] = [];
  const serialized = `${toolName} ${JSON.stringify(payload.args ?? {})}`;

  for (const pattern of BLOCKED_NETWORK_TARGETS) {
    if (pattern.test(serialized)) {
      violations.push({
        dimension: 'NETWORK',
        reason: `Outbound network target matches blocked exfil pattern: ${pattern.source}`,
        severity: 'CRITICAL',
      });
    }
  }

  if (payload.transport === 'http' && /external_upload|webhook|http_post/.test(toolName)) {
    const url = String(payload.args?.url ?? payload.args?.endpoint ?? '');
    if (url && !/^https:\/\/(api\.|hooks\.)/.test(url)) {
      violations.push({
        dimension: 'NETWORK',
        reason: `Unapproved external HTTP endpoint: ${url}`,
        severity: 'HIGH',
      });
    }
  }

  return violations;
}

function inspectData(
  toolName: string,
  payload: McpRuntimePayload,
): McpDimensionViolation[] {
  const violations: McpDimensionViolation[] = [];
  const serialized = `${toolName} ${JSON.stringify(payload.args ?? {})}`;

  for (const pattern of DATA_EXFIL_PATTERNS) {
    if (pattern.test(serialized)) {
      violations.push({
        dimension: 'DATA',
        reason: `Payload may contain sensitive data matching pattern: ${pattern.source}`,
        severity: 'HIGH',
      });
    }
  }

  for (const pattern of HIGH_RISK_TOOLS) {
    if (pattern.test(toolName)) {
      violations.push({
        dimension: 'DATA',
        reason: `High-risk data mutation tool "${toolName}" requires runtime isolation review`,
        severity: 'CRITICAL',
      });
    }
  }

  return violations;
}

function resolveDecision(
  violations: McpDimensionViolation[],
  riskScore: number,
): McpRuntimeDecision {
  if (violations.some((v) => v.severity === 'CRITICAL')) {
    if (violations.some((v) => v.dimension === 'IDENTITY' && v.severity === 'CRITICAL')) {
      return 'ISOLATE';
    }
    return 'BLOCK';
  }
  if (riskScore >= 70 || violations.some((v) => v.severity === 'HIGH')) {
    return 'REQUIRE_APPROVAL';
  }
  if (violations.length > 0) return 'REQUIRE_APPROVAL';
  return 'ALLOW';
}

export function evaluateMcpRuntimeAction(
  mcpServerId: string,
  toolName: string,
  payload: McpRuntimePayload = {},
): McpRuntimeEvaluation {
  const dimensionsChecked: McpControlDimension[] = ['IDENTITY', 'PERMISSIONS', 'NETWORK', 'DATA'];
  const violations = [
    ...inspectIdentity(mcpServerId, payload),
    ...inspectPermissions(toolName, payload),
    ...inspectNetwork(toolName, payload),
    ...inspectData(toolName, payload),
  ];

  let riskScore = 0;
  for (const violation of violations) {
    riskScore +=
      violation.severity === 'CRITICAL'
        ? 40
        : violation.severity === 'HIGH'
          ? 25
          : violation.severity === 'MEDIUM'
            ? 15
            : 8;
  }
  riskScore = Math.min(100, riskScore);

  return {
    decision: resolveDecision(violations, riskScore),
    mcpServerId,
    toolName,
    riskScore,
    violations,
    dimensionsChecked,
  };
}
