import type { AgentAsset, AgentCapability } from '@/lib/engine/discovery';

export type ElevatedRiskScope =
  | 'UNRESTRICTED_DELETE'
  | 'FINANCIAL_EXECUTE'
  | 'DATABASE_EXPORT'
  | 'CROSS_TENANT_ACCESS';

export type CredentialSource =
  | 'API_KEY'
  | 'OAUTH_TOKEN'
  | 'DATABASE_CONNECTION'
  | 'MCP_TOOL'
  | 'DECLARED_SCOPE';

export interface EffectiveScopeEntry {
  scope: ElevatedRiskScope | string;
  source: CredentialSource;
  detail: string;
  elevated: boolean;
}

export interface EffectiveAuthorityReport {
  declaredScopes: string[];
  effectiveScopes: string[];
  privilegeEscalationDetected: boolean;
  hiddenPermissions: string[];
  riskScore: number;
  elevatedRisks: ElevatedRiskScope[];
  entries: EffectiveScopeEntry[];
}

const CAPABILITY_LABELS: Record<AgentCapability, string> = {
  READ: 'Read Data',
  WRITE: 'Write Data',
  EXECUTE: 'Execute Commands',
  FINANCIAL: 'Financial Operations',
  WEB_SEARCH: 'Web Search',
  API_CALL: 'External API Call',
  DB_QUERY: 'Database Query',
};

const ELEVATED_SCOPE_WEIGHTS: Record<ElevatedRiskScope, number> = {
  UNRESTRICTED_DELETE: 35,
  FINANCIAL_EXECUTE: 30,
  DATABASE_EXPORT: 25,
  CROSS_TENANT_ACCESS: 40,
};

const OAUTH_PATTERNS: Array<{
  pattern: RegExp;
  scope: ElevatedRiskScope | string;
  elevated: boolean;
  detail: string;
}> = [
  {
    pattern: /(?:scope[s]?[=:]\s*['"][^'"]*(?:delete|destroy|purge|s3:delete)[^'"]*['"])/i,
    scope: 'UNRESTRICTED_DELETE',
    elevated: true,
    detail: 'OAuth token grants delete/destructive scope',
  },
  {
    pattern: /(?:scope[s]?[=:]\s*['"][^'"]*(?:payment|billing|stripe|swift|erp:write|financial)[^'"]*['"])/i,
    scope: 'FINANCIAL_EXECUTE',
    elevated: true,
    detail: 'OAuth token grants financial execution scope',
  },
  {
    pattern: /(?:scope[s]?[=:]\s*['"][^'"]*(?:export|dump|bulk_read|database:export)[^'"]*['"])/i,
    scope: 'DATABASE_EXPORT',
    elevated: true,
    detail: 'OAuth token grants database export scope',
  },
  {
    pattern: /(?:scope[s]?[=:]\s*['"][^'"]*(?:cross_tenant|all_tenants|org:admin|multi_org)[^'"]*['"])/i,
    scope: 'CROSS_TENANT_ACCESS',
    elevated: true,
    detail: 'OAuth token grants cross-tenant access',
  },
  {
    pattern: /(?:scope[s]?[=:]\s*['"][^'"]*(?:write|modify|admin)[^'"]*['"])/i,
    scope: 'FULL_WRITE',
    elevated: false,
    detail: 'OAuth token grants write/admin scope',
  },
  {
    pattern: /(?:scope[s]?[=:]\s*['"][^'"]*(?:read|readonly)[^'"]*['"])/i,
    scope: 'READ_ONLY',
    elevated: false,
    detail: 'OAuth token grants read-only scope',
  },
];

const API_KEY_PATTERNS: Array<{
  pattern: RegExp;
  scope: ElevatedRiskScope | string;
  elevated: boolean;
  detail: string;
}> = [
  {
    pattern: /(?:sk_live|STRIPE_SECRET|FINANCIAL_API|SWIFT_API|ERP_WRITE_KEY|PAYMENT_KEY)/i,
    scope: 'FINANCIAL_EXECUTE',
    elevated: true,
    detail: 'Live financial/payment API key detected',
  },
  {
    pattern: /(?:S3_DELETE|AWS_SECRET.*Delete|DELETE_ALL|DESTROY_TOKEN|PURGE_API)/i,
    scope: 'UNRESTRICTED_DELETE',
    elevated: true,
    detail: 'Delete-capable cloud/storage API key detected',
  },
  {
    pattern: /(?:DB_EXPORT|BULK_EXPORT_KEY|PG_DUMP_TOKEN|SQL_DUMP_API)/i,
    scope: 'DATABASE_EXPORT',
    elevated: true,
    detail: 'Database export API key detected',
  },
  {
    pattern: /(?:CROSS_TENANT|ALL_ORGS|MULTI_TENANT_ADMIN|GLOBAL_ACCESS)/i,
    scope: 'CROSS_TENANT_ACCESS',
    elevated: true,
    detail: 'Cross-tenant/global access API key detected',
  },
  {
    pattern: /(?:ADMIN_KEY|ROOT_TOKEN|SUPERUSER|FULL_ACCESS|FULL_DB_ADMIN)/i,
    scope: 'FULL_DB_ADMIN',
    elevated: true,
    detail: 'Admin/root API key implies full database authority',
  },
];

const DATABASE_CONNECTION_PATTERNS: Array<{
  pattern: RegExp;
  scope: ElevatedRiskScope | string;
  elevated: boolean;
  detail: string;
}> = [
  {
    pattern: /postgres(?:ql)?:\/\/[^@\s]+:[^@\s]+@[^/\s]+\/[^\s?"']+/i,
    scope: 'DATABASE_CONNECTION',
    elevated: false,
    detail: 'PostgreSQL connection string with credentials',
  },
  {
    pattern: /mysql:\/\/[^@\s]+:[^@\s]+@[^/\s]+\/[^\s?"']+/i,
    scope: 'DATABASE_CONNECTION',
    elevated: false,
    detail: 'MySQL connection string with credentials',
  },
  {
    pattern: /(?:DATABASE_URL|DB_CONNECTION).*superuser|postgres.*admin|root@/i,
    scope: 'FULL_DB_ADMIN',
    elevated: true,
    detail: 'Database connection with superuser/admin privileges',
  },
  {
    pattern: /(?:DATABASE_URL|DB_CONNECTION).*(?:delete|drop|truncate|destroy)/i,
    scope: 'UNRESTRICTED_DELETE',
    elevated: true,
    detail: 'Database connection string implies delete privileges',
  },
  {
    pattern: /(?:DATABASE_URL|DB_CONNECTION).*(?:export|dump|bulk|pg_dump)/i,
    scope: 'DATABASE_EXPORT',
    elevated: true,
    detail: 'Database connection configured for bulk export',
  },
  {
    pattern: /(?:tenant_id=\*|all_tenants|cross_org|multi_customer)/i,
    scope: 'CROSS_TENANT_ACCESS',
    elevated: true,
    detail: 'Database connection allows cross-tenant data access',
  },
];

const MCP_TOOL_PATTERNS: Array<{
  pattern: RegExp;
  scope: ElevatedRiskScope | string;
  elevated: boolean;
  detail: string;
}> = [
  { pattern: /delete_|remove_|purge_|drop_table|s3_delete/i, scope: 'UNRESTRICTED_DELETE', elevated: true, detail: 'MCP tool: delete capability' },
  { pattern: /stripe|payment|financial|transfer|billing|swift|erp_pay/i, scope: 'FINANCIAL_EXECUTE', elevated: true, detail: 'MCP tool: financial execution' },
  { pattern: /bulk_export|export_db|dump_db|sql_export|pg_dump/i, scope: 'DATABASE_EXPORT', elevated: true, detail: 'MCP tool: database export' },
  { pattern: /cross_tenant|all_orgs|global_customers|tenant_switch/i, scope: 'CROSS_TENANT_ACCESS', elevated: true, detail: 'MCP tool: cross-tenant access' },
  { pattern: /write_file|write_db|sql_mutation|modify_db/i, scope: 'FULL_WRITE', elevated: false, detail: 'MCP tool: write capability' },
  { pattern: /read_invoice|read_file|fetch_/i, scope: 'READ_INVOICES', elevated: false, detail: 'MCP tool: read capability' },
];

function capabilityToDeclaredScopes(capabilities: AgentCapability[]): string[] {
  return capabilities.map((capability) => CAPABILITY_LABELS[capability] ?? capability);
}

function inferDeclaredFromAgent(agent: AgentAsset): EffectiveScopeEntry[] {
  return agent.capabilities.map((capability) => ({
    scope: CAPABILITY_LABELS[capability] ?? capability,
    source: 'DECLARED_SCOPE' as const,
    detail: `Agent declares ${CAPABILITY_LABELS[capability] ?? capability}`,
    elevated: false,
  }));
}

function scanContent(content: string, patterns: typeof OAUTH_PATTERNS, source: CredentialSource): EffectiveScopeEntry[] {
  const entries: EffectiveScopeEntry[] = [];
  for (const mapping of patterns) {
    if (mapping.pattern.test(content)) {
      entries.push({
        scope: mapping.scope,
        source,
        detail: mapping.detail,
        elevated: mapping.elevated,
      });
    }
  }
  return entries;
}

function inferFromMcpTools(agent: AgentAsset): EffectiveScopeEntry[] {
  const entries: EffectiveScopeEntry[] = [];
  const tools = agent.mcpConnections.flatMap((connection) => connection.tools);

  for (const tool of tools) {
    for (const mapping of MCP_TOOL_PATTERNS) {
      if (mapping.pattern.test(tool)) {
        entries.push({
          scope: mapping.scope,
          source: 'MCP_TOOL',
          detail: `${mapping.detail}: ${tool}`,
          elevated: mapping.elevated,
        });
      }
    }
  }

  return entries;
}

function dedupeEntries(entries: EffectiveScopeEntry[]): EffectiveScopeEntry[] {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    const key = `${entry.scope}:${entry.source}:${entry.detail}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function computeRiskScore(elevatedRisks: ElevatedRiskScope[], hiddenPermissions: string[]): number {
  let score = 0;
  const uniqueElevated = [...new Set(elevatedRisks)];

  for (const risk of uniqueElevated) {
    score += ELEVATED_SCOPE_WEIGHTS[risk];
  }

  score += Math.min(20, hiddenPermissions.length * 5);

  return Math.min(100, Math.max(0, score));
}

function isElevatedScope(scope: string): scope is ElevatedRiskScope {
  return (
    scope === 'UNRESTRICTED_DELETE' ||
    scope === 'FINANCIAL_EXECUTE' ||
    scope === 'DATABASE_EXPORT' ||
    scope === 'CROSS_TENANT_ACCESS'
  );
}

function normalizeScopeLabel(scope: string): string {
  return scope.replace(/_/g, ' ');
}

export function detectEffectiveAuthority(
  agent: AgentAsset,
  fileContent?: string,
): EffectiveAuthorityReport {
  const declaredScopes = capabilityToDeclaredScopes(agent.capabilities);
  const declaredSet = new Set(declaredScopes.map((scope) => scope.toUpperCase()));

  const credentialEntries = fileContent
    ? [
        ...scanContent(fileContent, OAUTH_PATTERNS, 'OAUTH_TOKEN'),
        ...scanContent(fileContent, API_KEY_PATTERNS, 'API_KEY'),
        ...scanContent(fileContent, DATABASE_CONNECTION_PATTERNS, 'DATABASE_CONNECTION'),
      ]
    : [];

  const entries = dedupeEntries([
    ...inferDeclaredFromAgent(agent),
    ...inferFromMcpTools(agent),
    ...credentialEntries,
  ]);

  const effectiveScopes = [...new Set(entries.map((entry) => normalizeScopeLabel(entry.scope)))];

  const hiddenPermissions = entries
    .filter((entry) => entry.source !== 'DECLARED_SCOPE')
    .map((entry) => normalizeScopeLabel(entry.scope))
    .filter((scope) => {
      const normalized = scope.toUpperCase();
      return ![...declaredSet].some(
        (declared) => normalized.includes(declared) || declared.includes(normalized),
      );
    });

  const uniqueHidden = [...new Set(hiddenPermissions)];

  const elevatedRisks = [
    ...new Set(
      entries
        .filter((entry) => isElevatedScope(entry.scope))
        .map((entry) => entry.scope as ElevatedRiskScope),
    ),
  ];

  const privilegeEscalationDetected =
    elevatedRisks.length > 0 &&
    entries.some(
      (entry) =>
        entry.source !== 'DECLARED_SCOPE' &&
        (entry.elevated || isElevatedScope(entry.scope)),
    ) &&
    uniqueHidden.length > 0;

  const riskScore = computeRiskScore(elevatedRisks, uniqueHidden);

  return {
    declaredScopes,
    effectiveScopes,
    privilegeEscalationDetected,
    hiddenPermissions: uniqueHidden,
    riskScore,
    elevatedRisks,
    entries,
  };
}

export function formatDeclaredSummary(report: EffectiveAuthorityReport): string {
  if (report.declaredScopes.length === 0) return 'None Declared';
  if (report.declaredScopes.length === 1) return report.declaredScopes[0];
  return report.declaredScopes.slice(0, 2).join(', ');
}

export function formatEffectiveSummary(report: EffectiveAuthorityReport): string {
  if (report.effectiveScopes.length === 0) return 'READ ONLY';
  const primary = report.effectiveScopes.find((scope) =>
    /FULL DB ADMIN|UNRESTRICTED DELETE|FINANCIAL EXECUTE|DATABASE EXPORT|CROSS TENANT/i.test(scope),
  );
  return primary ?? report.effectiveScopes[report.effectiveScopes.length - 1];
}
