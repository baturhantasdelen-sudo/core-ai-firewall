export interface TrajectoryEntry {
  toolName: string;
  category: string;
  timestamp: string;
  baseRiskScore: number;
}

export interface ToolChainEvaluation {
  matched: boolean;
  chainRiskBoost: number;
  compoundedRiskScore: number;
  violation?: string;
  shouldBlock: boolean;
  trajectory: TrajectoryEntry[];
  detectedPattern?: string;
}

const DEFAULT_TRAJECTORY_LIMIT = 10;

const trajectoryStore = new Map<string, TrajectoryEntry[]>();

const DANGEROUS_CHAINS: Array<{ pattern: string[]; label: string; multiplier: number }> = [
  {
    pattern: ['read_invoice', 'read_db', 'export_csv'],
    label: 'read_invoice → read_db → export_csv',
    multiplier: 3.5,
  },
  {
    pattern: ['read', 'db_read', 'export'],
    label: 'read → db_read → export',
    multiplier: 3,
  },
  {
    pattern: ['read', 'db_query', 'bulk_export'],
    label: 'read → db_query → bulk_export',
    multiplier: 3.2,
  },
  {
    pattern: ['api_read', 'db_read', 'external_upload'],
    label: 'api_read → db_read → external_upload',
    multiplier: 2.8,
  },
];

function abstractToolCategory(toolName: string): string {
  const normalized = toolName.toLowerCase();

  if (/read_invoice|invoice_read|get_invoice/.test(normalized)) return 'read_invoice';
  if (/read_db|db_read|sql_query|query_database/.test(normalized)) return 'read_db';
  if (/export_csv|csv_export|download_csv/.test(normalized)) return 'export_csv';
  if (/bulk_export|export_db|dump_db|sql_export/.test(normalized)) return 'bulk_export';
  if (/db_query|database_query|postgres_query/.test(normalized)) return 'db_query';
  if (/external_upload|upload_external|send_to_webhook/.test(normalized)) return 'external_upload';
  if (/^read_|_read$|fetch_|get_/.test(normalized) || /read_file|load_file/.test(normalized)) {
    return 'read';
  }
  if (/db_|database|sql/.test(normalized)) return 'db_read';
  if (/export|download|dump/.test(normalized)) return 'export';
  if (/api_|http_|fetch_url|rest_/.test(normalized)) return 'api_read';

  return normalized.replace(/[^a-z0-9_]/g, '_').slice(0, 24);
}

function getTrajectory(agentId: string): TrajectoryEntry[] {
  return trajectoryStore.get(agentId) ?? [];
}

export function recordToolCall(
  agentId: string,
  toolName: string,
  baseRiskScore = 0,
  limit = DEFAULT_TRAJECTORY_LIMIT,
): TrajectoryEntry[] {
  const entry: TrajectoryEntry = {
    toolName,
    category: abstractToolCategory(toolName),
    timestamp: new Date().toISOString(),
    baseRiskScore,
  };

  const existing = getTrajectory(agentId);
  const updated = [...existing, entry].slice(-limit);
  trajectoryStore.set(agentId, updated);
  return updated;
}

function matchesChain(recentCategories: string[], pattern: string[]): boolean {
  if (recentCategories.length < pattern.length) return false;

  const window = recentCategories.slice(-pattern.length);
  return window.every((category, index) => category === pattern[index]);
}

export function evaluateToolChain(params: {
  agentId: string;
  toolName: string;
  baseRiskScore: number;
}): ToolChainEvaluation {
  const category = abstractToolCategory(params.toolName);
  const prior = getTrajectory(params.agentId);
  const categories = [...prior.map((entry) => entry.category), category];

  for (const chain of DANGEROUS_CHAINS) {
    if (matchesChain(categories, chain.pattern)) {
      const compoundedRiskScore = Math.min(
        100,
        Math.round(params.baseRiskScore * chain.multiplier + 25),
      );
      const shouldBlock = compoundedRiskScore > 85;

      return {
        matched: true,
        chainRiskBoost: compoundedRiskScore - params.baseRiskScore,
        compoundedRiskScore,
        violation: `TOOL_CHAIN_ESCALATION: compound pattern ${chain.label}`,
        shouldBlock,
        trajectory: prior,
        detectedPattern: chain.label,
      };
    }
  }

  return {
    matched: false,
    chainRiskBoost: 0,
    compoundedRiskScore: params.baseRiskScore,
    shouldBlock: false,
    trajectory: prior,
  };
}

export function getAgentTrajectory(agentId: string): TrajectoryEntry[] {
  return [...getTrajectory(agentId)];
}

export function resetTrajectory(agentId?: string): void {
  if (agentId) {
    trajectoryStore.delete(agentId);
    return;
  }
  trajectoryStore.clear();
}
