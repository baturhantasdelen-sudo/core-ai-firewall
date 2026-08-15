import type {
  TrajectoryChain,
  TrajectoryEvaluation,
  TrajectoryRiskScore,
  TrajectoryStep,
  TrajectoryStepCategory,
} from '@/lib/trajectory/types';
import {
  TRAJECTORY_HIGH_RISK_THRESHOLD,
  resolveTrajectoryLevel,
} from '@/lib/trajectory/types';

export const TRAJECTORY_WINDOW_MS = 30_000;

const chainStore = new Map<string, TrajectoryStep[]>();

const CATEGORY_PATTERNS: Array<{ pattern: RegExp; category: TrajectoryStepCategory }> = [
  { pattern: /read_invoice|fetch_invoice|get_invoice/i, category: 'READ_INVOICE' },
  { pattern: /read_customer|customer_db|crm_read|client_record/i, category: 'READ_CUSTOMER_DB' },
  { pattern: /get_credential|fetch_secret|api_key|token_vault|oauth_token/i, category: 'GET_CREDENTIALS' },
  { pattern: /external_api|send_http|http_request|webhook|call_api|upload_external/i, category: 'EXTERNAL_API' },
  { pattern: /read_db|sql_query|db_read|postgres_query/i, category: 'READ_DB' },
  { pattern: /write_file|save_file|file_write/i, category: 'WRITE_FILE' },
  { pattern: /write_db|insert_db|update_db/i, category: 'WRITE_DB' },
  { pattern: /bulk_export|export_db|dump_db|sql_export/i, category: 'EXPORT' },
  { pattern: /stripe|payment|financial|swift|erp_pay/i, category: 'FINANCIAL' },
  { pattern: /exec|shell|run_command|subprocess/i, category: 'EXECUTE' },
];

const ANOMALY_SEQUENCES: Array<{
  pattern: TrajectoryStepCategory[];
  label: string;
  score: number;
  reason: string;
}> = [
  {
    pattern: ['READ_INVOICE', 'READ_CUSTOMER_DB', 'GET_CREDENTIALS', 'EXTERNAL_API'],
    label: 'READ_INVOICE → READ_CUSTOMER_DB → GET_CREDENTIALS → EXTERNAL_API',
    score: 0.92,
    reason:
      'Credential exfiltration chain: invoice read escalates to customer DB, credential harvest, and external egress',
  },
  {
    pattern: ['READ_DB', 'EXTERNAL_API', 'WRITE_FILE'],
    label: 'READ_DB → EXTERNAL_API → WRITE_FILE',
    score: 0.9,
    reason: 'Data staging exfiltration: database read relayed via API then persisted externally',
  },
  {
    pattern: ['READ_CUSTOMER_DB', 'GET_CREDENTIALS', 'EXTERNAL_API'],
    label: 'READ_CUSTOMER_DB → GET_CREDENTIALS → EXTERNAL_API',
    score: 0.88,
    reason: 'Sensitive customer data combined with credential access and outbound API',
  },
  {
    pattern: ['READ_INVOICE', 'EXTERNAL_API'],
    label: 'READ_INVOICE → EXTERNAL_API',
    score: 0.72,
    reason: 'Invoice data egress via external API within trajectory window',
  },
  {
    pattern: ['READ_DB', 'EXPORT'],
    label: 'READ_DB → EXPORT',
    score: 0.78,
    reason: 'Progressive harvesting ending in bulk export',
  },
  {
    pattern: ['GET_CREDENTIALS', 'FINANCIAL'],
    label: 'GET_CREDENTIALS → FINANCIAL',
    score: 0.86,
    reason: 'Credential access chained into financial execution',
  },
];

export function classifyTrajectoryStep(toolName: string): TrajectoryStepCategory {
  for (const mapping of CATEGORY_PATTERNS) {
    if (mapping.pattern.test(toolName)) return mapping.category;
  }
  return 'GENERIC';
}

function withinWindow(timestamp: string, nowMs: number): boolean {
  return nowMs - new Date(timestamp).getTime() <= TRAJECTORY_WINDOW_MS;
}

function pruneWindow(steps: TrajectoryStep[], nowMs = Date.now()): TrajectoryStep[] {
  return steps.filter((step) => withinWindow(step.timestamp, nowMs));
}

function matchesPattern(vector: TrajectoryStepCategory[], pattern: TrajectoryStepCategory[]): boolean {
  if (vector.length < pattern.length) return false;
  const tail = vector.slice(-pattern.length);
  return tail.every((cat, i) => cat === pattern[i]);
}

function computeHeuristicScore(vector: TrajectoryStepCategory[]): number {
  const set = new Set(vector);
  let score = 0;

  if (set.has('READ_INVOICE') && set.has('EXTERNAL_API')) score += 0.35;
  if (set.has('READ_CUSTOMER_DB') && set.has('GET_CREDENTIALS')) score += 0.4;
  if (set.has('GET_CREDENTIALS') && set.has('EXTERNAL_API')) score += 0.45;
  if (set.has('READ_DB') && set.has('EXPORT')) score += 0.3;
  if (vector.length >= 4) score += 0.1;
  if (vector.filter((c) => c !== 'GENERIC').length >= 3) score += 0.08;

  return Math.min(1, score);
}

function buildRiskScore(
  vector: TrajectoryStepCategory[],
  anomalousSteps: string[],
  matched?: (typeof ANOMALY_SEQUENCES)[number],
): TrajectoryRiskScore {
  const score = matched?.score ?? computeHeuristicScore(vector);
  return {
    score,
    level: resolveTrajectoryLevel(score),
    sequenceViolationDetected: Boolean(matched),
    matchedPattern: matched?.label,
    reason: matched?.reason ?? (score >= TRAJECTORY_HIGH_RISK_THRESHOLD
      ? 'Multi-step action vector exceeds high trajectory risk threshold'
      : 'No critical chained sequence detected in current window'),
    anomalousSteps,
  };
}

export function recordTrajectoryStep(agentId: string, step: Omit<TrajectoryStep, 'category' | 'index'>): TrajectoryStep[] {
  const category = classifyTrajectoryStep(step.toolName);
  const existing = pruneWindow(chainStore.get(agentId) ?? []);
  const enriched: TrajectoryStep = {
    ...step,
    category,
    index: existing.length,
  };
  const updated = [...existing, enriched];
  chainStore.set(agentId, updated);
  return updated;
}

export function getTrajectorySteps(agentId: string): TrajectoryStep[] {
  return pruneWindow(chainStore.get(agentId) ?? []);
}

export function buildTrajectoryChain(
  agentId: string,
  steps: TrajectoryStep[],
  agentName?: string,
): TrajectoryChain {
  const pruned = pruneWindow(steps);
  const now = Date.now();

  return {
    agentId,
    agentName,
    steps: pruned.map((step, index) => ({ ...step, index })),
    windowStartedAt: pruned.length > 0 ? pruned[0]!.timestamp : new Date(now - TRAJECTORY_WINDOW_MS).toISOString(),
    windowEndsAt: new Date(now).toISOString(),
  };
}

/**
 * Evaluates sequential action vector [A_1..A_n] for chained anomaly risk.
 */
export function evaluateTrajectory(
  agentId: string,
  incomingSteps: Array<Omit<TrajectoryStep, 'category' | 'index'>>,
  options?: { agentName?: string },
): TrajectoryEvaluation {
  const stored = getTrajectorySteps(agentId);
  const enrichedIncoming: TrajectoryStep[] = incomingSteps.map((step, index) => ({
    ...step,
    category: classifyTrajectoryStep(step.toolName),
    index: stored.length + index,
  }));

  const merged = pruneWindow([...stored, ...enrichedIncoming]);
  chainStore.set(agentId, merged);

  const actionVector = merged.map((step) => step.category);
  const anomalousSteps = merged
    .filter((step) => step.category !== 'GENERIC')
    .map((step) => step.toolName);

  let matched: (typeof ANOMALY_SEQUENCES)[number] | undefined;
  for (const sequence of ANOMALY_SEQUENCES) {
    if (matchesPattern(actionVector, sequence.pattern)) {
      matched = sequence;
      break;
    }
  }

  const chain = buildTrajectoryChain(agentId, merged, options?.agentName);
  const risk = buildRiskScore(actionVector, anomalousSteps, matched);

  return { chain, risk, actionVector };
}

export function resetTrajectoryStore(agentId?: string): void {
  if (agentId) {
    chainStore.delete(agentId);
    return;
  }
  chainStore.clear();
}

/** Demo chain for dashboards — ReadInvoice → ReadCustomerDB → GetCredentials → ExternalAPI */
export function buildDemoExfiltrationChain(agentId: string, agentName: string): TrajectoryEvaluation {
  resetTrajectoryStore(agentId);
  const base = Date.now() - 20_000;
  return evaluateTrajectory(
    agentId,
    [
      { id: 's1', toolName: 'read_invoice', timestamp: new Date(base).toISOString() },
      { id: 's2', toolName: 'read_customer_db', timestamp: new Date(base + 5000).toISOString() },
      { id: 's3', toolName: 'get_credentials', timestamp: new Date(base + 12000).toISOString() },
      { id: 's4', toolName: 'external_api', timestamp: new Date(base + 18000).toISOString() },
    ],
    { agentName },
  );
}
