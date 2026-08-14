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

export type EffectiveAuthorityScope =
  | 'UNRESTRICTED_WRITE'
  | 'UNRESTRICTED_DELETE'
  | 'FINANCIAL_ACCESS'
  | 'EXECUTE_SHELL'
  | 'DB_MUTATION'
  | 'READ_ONLY';

export type AuthoritySource = 'API_KEY' | 'OAUTH_SCOPE' | 'MCP_TOOL' | 'DECLARED_CAPABILITY';

export interface EffectiveAuthorityEntry {
  scope: EffectiveAuthorityScope;
  source: AuthoritySource;
  riskLevel: AgentRiskLevel;
  detail: string;
}

export interface EffectiveAuthorityMatrix {
  declared: AgentCapability[];
  effective: EffectiveAuthorityEntry[];
  overallRisk: AgentRiskLevel;
  hasUnrestrictedWrite: boolean;
  hasUnrestrictedDelete: boolean;
  hasFinancialAccess: boolean;
}

export interface EnrichedAgentAsset extends AgentAsset {
  effectiveAuthority: EffectiveAuthorityMatrix;
}

export interface EnrichedAgentDiscoveryResult extends AgentDiscoveryResult {
  agents: EnrichedAgentAsset[];
}

const OAUTH_SCOPE_PATTERNS: Array<{
  pattern: RegExp;
  scope: EffectiveAuthorityScope;
  riskLevel: AgentRiskLevel;
  detail: string;
}> = [
  {
    pattern: /(?:scope[s]?[=:]\s*['"][^'"]*(?:write|modify|admin)[^'"]*['"])/i,
    scope: 'UNRESTRICTED_WRITE',
    riskLevel: 'HIGH',
    detail: 'OAuth scope grants unrestricted write access',
  },
  {
    pattern: /(?:scope[s]?[=:]\s*['"][^'"]*(?:delete|destroy|purge)[^'"]*['"])/i,
    scope: 'UNRESTRICTED_DELETE',
    riskLevel: 'CRITICAL',
    detail: 'OAuth scope grants unrestricted delete access',
  },
  {
    pattern: /(?:scope[s]?[=:]\s*['"][^'"]*(?:payment|billing|financial|stripe|bank)[^'"]*['"])/i,
    scope: 'FINANCIAL_ACCESS',
    riskLevel: 'CRITICAL',
    detail: 'OAuth scope grants financial mutation access',
  },
  {
    pattern: /(?:scope[s]?[=:]\s*['"][^'"]*(?:execute|shell|run_command)[^'"]*['"])/i,
    scope: 'EXECUTE_SHELL',
    riskLevel: 'CRITICAL',
    detail: 'OAuth scope grants shell execution access',
  },
];

const API_KEY_PATTERNS: Array<{
  pattern: RegExp;
  scope: EffectiveAuthorityScope;
  riskLevel: AgentRiskLevel;
  detail: string;
}> = [
  {
    pattern: /(?:sk_live|STRIPE_SECRET|FINANCIAL_API|BILLING_KEY|PAYMENT_KEY)/i,
    scope: 'FINANCIAL_ACCESS',
    riskLevel: 'CRITICAL',
    detail: 'Live financial API key detected — effective financial access',
  },
  {
    pattern: /(?:ADMIN_KEY|ROOT_TOKEN|SUPERUSER|FULL_ACCESS|WRITE_ALL)/i,
    scope: 'UNRESTRICTED_WRITE',
    riskLevel: 'CRITICAL',
    detail: 'Admin/root API key implies unrestricted write authority',
  },
  {
    pattern: /(?:DELETE_KEY|DESTROY_TOKEN|PURGE_API)/i,
    scope: 'UNRESTRICTED_DELETE',
    riskLevel: 'CRITICAL',
    detail: 'Delete-capable API key detected',
  },
];

const MCP_TOOL_AUTHORITY: Array<{
  pattern: RegExp;
  scope: EffectiveAuthorityScope;
  riskLevel: AgentRiskLevel;
  detail: string;
}> = [
  { pattern: /write_file|write_db|store_|upload_/i, scope: 'UNRESTRICTED_WRITE', riskLevel: 'HIGH', detail: 'MCP tool grants write access' },
  { pattern: /delete_|remove_|purge_|drop_table/i, scope: 'UNRESTRICTED_DELETE', riskLevel: 'CRITICAL', detail: 'MCP tool grants delete access' },
  { pattern: /stripe|payment|financial|transfer|billing/i, scope: 'FINANCIAL_ACCESS', riskLevel: 'CRITICAL', detail: 'MCP tool grants financial access' },
  { pattern: /execute_shell|run_command|subprocess|terminal/i, scope: 'EXECUTE_SHELL', riskLevel: 'CRITICAL', detail: 'MCP tool grants shell execution' },
  { pattern: /sql_mutation|insert_|update_db|modify_db/i, scope: 'DB_MUTATION', riskLevel: 'HIGH', detail: 'MCP tool grants database mutation' },
];

const RISK_ORDER: AgentRiskLevel[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

function maxRisk(a: AgentRiskLevel, b: AgentRiskLevel): AgentRiskLevel {
  return RISK_ORDER.indexOf(a) >= RISK_ORDER.indexOf(b) ? a : b;
}

function inferFromDeclaredCapabilities(capabilities: AgentCapability[]): EffectiveAuthorityEntry[] {
  const entries: EffectiveAuthorityEntry[] = [];

  if (capabilities.includes('WRITE')) {
    entries.push({
      scope: 'UNRESTRICTED_WRITE',
      source: 'DECLARED_CAPABILITY',
      riskLevel: 'HIGH',
      detail: 'Agent declares WRITE capability',
    });
  }
  if (capabilities.includes('EXECUTE')) {
    entries.push({
      scope: 'EXECUTE_SHELL',
      source: 'DECLARED_CAPABILITY',
      riskLevel: 'CRITICAL',
      detail: 'Agent declares EXECUTE capability',
    });
  }
  if (capabilities.includes('FINANCIAL')) {
    entries.push({
      scope: 'FINANCIAL_ACCESS',
      source: 'DECLARED_CAPABILITY',
      riskLevel: 'CRITICAL',
      detail: 'Agent declares FINANCIAL capability',
    });
  }
  if (capabilities.includes('DB_QUERY') && capabilities.includes('WRITE')) {
    entries.push({
      scope: 'DB_MUTATION',
      source: 'DECLARED_CAPABILITY',
      riskLevel: 'HIGH',
      detail: 'Combined DB_QUERY + WRITE implies mutation authority',
    });
  }

  return entries;
}

function inferFromMcpTools(agent: AgentAsset): EffectiveAuthorityEntry[] {
  const entries: EffectiveAuthorityEntry[] = [];
  const allTools = agent.mcpConnections.flatMap((connection) => connection.tools);

  for (const tool of allTools) {
    for (const mapping of MCP_TOOL_AUTHORITY) {
      if (mapping.pattern.test(tool)) {
        entries.push({
          scope: mapping.scope,
          source: 'MCP_TOOL',
          riskLevel: mapping.riskLevel,
          detail: `${mapping.detail}: ${tool}`,
        });
      }
    }
  }

  return entries;
}

function inferFromCredentials(content: string): EffectiveAuthorityEntry[] {
  const entries: EffectiveAuthorityEntry[] = [];

  for (const mapping of OAUTH_SCOPE_PATTERNS) {
    if (mapping.pattern.test(content)) {
      entries.push({
        scope: mapping.scope,
        source: 'OAUTH_SCOPE',
        riskLevel: mapping.riskLevel,
        detail: mapping.detail,
      });
    }
  }

  for (const mapping of API_KEY_PATTERNS) {
    if (mapping.pattern.test(content)) {
      entries.push({
        scope: mapping.scope,
        source: 'API_KEY',
        riskLevel: mapping.riskLevel,
        detail: mapping.detail,
      });
    }
  }

  return entries;
}

function dedupeEntries(entries: EffectiveAuthorityEntry[]): EffectiveAuthorityEntry[] {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    const key = `${entry.scope}:${entry.source}:${entry.detail}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function computeEffectiveAuthority(
  agent: AgentAsset,
  fileContent?: string,
): EffectiveAuthorityMatrix {
  const effective = dedupeEntries([
    ...inferFromDeclaredCapabilities(agent.capabilities),
    ...inferFromMcpTools(agent),
    ...(fileContent ? inferFromCredentials(fileContent) : []),
  ]);

  const hasUnrestrictedWrite = effective.some((entry) => entry.scope === 'UNRESTRICTED_WRITE' || entry.scope === 'DB_MUTATION');
  const hasUnrestrictedDelete = effective.some((entry) => entry.scope === 'UNRESTRICTED_DELETE');
  const hasFinancialAccess = effective.some((entry) => entry.scope === 'FINANCIAL_ACCESS');

  let overallRisk: AgentRiskLevel = agent.riskLevel;
  for (const entry of effective) {
    overallRisk = maxRisk(overallRisk, entry.riskLevel);
  }

  if (hasUnrestrictedDelete || (hasFinancialAccess && hasUnrestrictedWrite)) {
    overallRisk = 'CRITICAL';
  }

  return {
    declared: agent.capabilities,
    effective,
    overallRisk,
    hasUnrestrictedWrite,
    hasUnrestrictedDelete,
    hasFinancialAccess,
  };
}

export function enrichAgentAsset(agent: AgentAsset, fileContent?: string): EnrichedAgentAsset {
  return {
    ...agent,
    effectiveAuthority: computeEffectiveAuthority(agent, fileContent),
  };
}

export function enrichAgentInventory(
  agents: AgentAsset[],
  fileContents?: Map<string, string>,
): EnrichedAgentAsset[] {
  return agents.map((agent) =>
    enrichAgentAsset(agent, fileContents?.get(agent.sourceFile)),
  );
}

export function discoverAgentsWithAuthority(files: DiscoveryFileInput[]): EnrichedAgentDiscoveryResult {
  const result = discoverAgents(files);
  const contentMap = new Map(files.map((file) => [file.path.replace(/\\/g, '/'), file.content]));

  const agents = enrichAgentInventory(result.agents, contentMap);

  return {
    ...result,
    critical_agents: agents.filter(
      (agent) =>
        agent.riskLevel === 'CRITICAL' || agent.effectiveAuthority.overallRisk === 'CRITICAL',
    ).length,
    agents,
  };
}

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
