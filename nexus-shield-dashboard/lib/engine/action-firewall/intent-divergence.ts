const INTENT_KEYWORDS: Record<string, RegExp[]> = {
  invoice: [/invoice/i, /billing/i, /receipt/i, /fatura/i],
  read: [/\bread\b/i, /\bview\b/i, /\bcheck\b/i, /\binspect\b/i, /\blookup\b/i],
  export: [/\bexport\b/i, /\bdownload\b/i, /\bdump\b/i, /\bextract\b/i],
  payment: [/\bpay\b/i, /\btransfer\b/i, /\bcharge\b/i, /\brefund\b/i],
  search: [/\bsearch\b/i, /\bfind\b/i, /\blookup\b/i],
  execute: [/\brun\b/i, /\bexecute\b/i, /\bdeploy\b/i, /\brestart\b/i],
  database: [/\bdatabase\b/i, /\bsql\b/i, /\bquery\b/i, /\bdb\b/i, /\brecord\b/i],
};

function normalizeForTokenMatch(text: string): string {
  return text.replace(/_/g, ' ');
}

export function inferIntentTags(userIntent: string): string[] {
  const intent = normalizeForTokenMatch(userIntent.toLowerCase());
  return Object.entries(INTENT_KEYWORDS)
    .filter(([, patterns]) => patterns.some((pattern) => pattern.test(intent)))
    .map(([tag]) => tag);
}

export interface ToolCallStep {
  tool: string;
  args?: Record<string, unknown>;
  timestamp?: string;
}

export type DivergenceSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type DivergenceRecommendation = 'ALLOW' | 'REVOKE_CAPABILITIES' | 'BLOCK_ACTION';

export interface IntentDivergenceReport {
  divergenceScore: number;
  severity: DivergenceSeverity;
  mismatchedSteps: Array<{ tool: string; reason: string }>;
  recommendation: DivergenceRecommendation;
  violation?: string;
  shouldBlock: boolean;
  intentTags: string[];
  intentMatchScore: number;
}

export const INTENT_DIVERGENCE_THRESHOLD = 80;

const TOOL_SEMANTIC_MAP: Array<{
  pattern: RegExp;
  tag: string;
  riskWeight: number;
}> = [
  { pattern: /read_invoice|invoice_read|get_invoice/i, tag: 'invoice', riskWeight: 0 },
  { pattern: /read_file|fetch_|get_|load_/i, tag: 'read', riskWeight: 0 },
  { pattern: /bulk_export|export_db|export_customer|dump_db|sql_export|pg_dump/i, tag: 'export', riskWeight: 35 },
  { pattern: /stripe|payment|transfer|financial|billing|swift/i, tag: 'payment', riskWeight: 30 },
  { pattern: /exec|shell|run_command|subprocess|terminal/i, tag: 'execute', riskWeight: 28 },
  { pattern: /read_db|db_query|sql_query|database/i, tag: 'database', riskWeight: 10 },
  { pattern: /external_upload|upload_external|send_to_webhook|http_post/i, tag: 'external_upload', riskWeight: 40 },
  { pattern: /delete_|remove_|purge_|drop_table|s3_delete/i, tag: 'delete', riskWeight: 38 },
  { pattern: /web_search|search_web|browse/i, tag: 'search', riskWeight: 0 },
];

const INTENT_EXPORT_FORBIDDEN = /\bexport\b|\bdump\b|\bdownload all\b/i;
const INTENT_READ_LIKE = /\bcheck\b|\bview\b|\binspect\b|\blookup\b|\bread\b|\binvoice\b/i;
const INTENT_PAYMENT = /\bpay\b|\bcharge\b|\btransfer\b|\brefund\b/i;

function normalizeToolName(tool: string): string {
  return tool.replace(/_/g, ' ').toLowerCase();
}

function classifyTool(step: ToolCallStep): { tag: string; riskWeight: number } {
  const haystack = `${step.tool} ${JSON.stringify(step.args ?? {})}`;
  for (const mapping of TOOL_SEMANTIC_MAP) {
    if (mapping.pattern.test(haystack)) {
      return { tag: mapping.tag, riskWeight: mapping.riskWeight };
    }
  }
  return { tag: 'unknown', riskWeight: 5 };
}

function isExternalUploadToUnexpectedTarget(step: ToolCallStep): string | null {
  const args = step.args ?? {};
  const url = String(args.url ?? args.endpoint ?? args.webhook ?? args.destination ?? '');
  const tool = step.tool.toLowerCase();

  if (!/(external_upload|upload_external|send_to_webhook|http_post|fetch_url)/i.test(tool)) {
    return null;
  }

  if (/evil\.|pastebin|anonymous|unknown|attacker|exfil/i.test(url)) {
    return `Unexpected external upload target: ${url || 'unspecified destination'}`;
  }

  if (!url && /upload|external|webhook/i.test(tool)) {
    return 'External API upload without declared destination — potential exfiltration vector';
  }

  return null;
}

function analyzeStepAgainstIntent(
  intent: string,
  intentTags: string[],
  step: ToolCallStep,
): { tool: string; reason: string; scoreBoost: number } | null {
  const normalizedIntent = intent.toLowerCase();
  const { tag, riskWeight } = classifyTool(step);
  const toolNorm = normalizeToolName(step.tool);

  if (INTENT_READ_LIKE.test(normalizedIntent) && !INTENT_EXPORT_FORBIDDEN.test(normalizedIntent)) {
    if (tag === 'export' || /export_customer_database|bulk_export/.test(step.tool)) {
      return {
        tool: step.tool,
        reason: `Semantic drift: read/check intent but tool performs bulk export (${step.tool})`,
        scoreBoost: 40 + riskWeight,
      };
    }
    if (tag === 'delete') {
      return {
        tool: step.tool,
        reason: `Semantic drift: read intent but destructive delete tool invoked (${step.tool})`,
        scoreBoost: 45 + riskWeight,
      };
    }
    if (tag === 'payment' && !INTENT_PAYMENT.test(normalizedIntent)) {
      return {
        tool: step.tool,
        reason: `Privilege escalation: non-financial intent vs payment tool (${step.tool})`,
        scoreBoost: 35 + riskWeight,
      };
    }
    if (tag === 'execute') {
      return {
        tool: step.tool,
        reason: `Semantic drift: read intent vs shell/execute tool (${step.tool})`,
        scoreBoost: 30 + riskWeight,
      };
    }
  }

  if (tag === 'external_upload') {
    const externalReason = isExternalUploadToUnexpectedTarget(step);
    if (externalReason) {
      return { tool: step.tool, reason: externalReason, scoreBoost: 42 };
    }
  }

  if (intentTags.length > 0) {
    const overlap = intentTags.includes(tag) || (intentTags.includes('read') && tag === 'invoice');
    if (!overlap && riskWeight >= 25) {
      return {
        tool: step.tool,
        reason: `Trajectory step "${step.tool}" (${tag}) outside declared intent tags [${intentTags.join(', ')}]`,
        scoreBoost: riskWeight,
      };
    }
  }

  if (/export_customer_database/i.test(step.tool) && /invoice/i.test(normalizedIntent)) {
    return {
      tool: step.tool,
      reason: 'Critical mismatch: invoice review intent vs export_customer_database',
      scoreBoost: 50,
    };
  }

  if (toolNorm.includes('export') && intentTags.includes('read') && !intentTags.includes('export')) {
    return {
      tool: step.tool,
      reason: `Database export tool "${step.tool}" diverges from read-only intent`,
      scoreBoost: 38,
    };
  }

  return null;
}

function computeTagAlignment(intentTags: string[], trajectory: ToolCallStep[]): number {
  if (trajectory.length === 0) return 100;

  const trajectoryTags = new Set<string>();
  for (const step of trajectory) {
    trajectoryTags.add(classifyTool(step).tag);
  }

  if (intentTags.length === 0) {
    const hasHighRisk = [...trajectoryTags].some((tag) =>
      ['export', 'payment', 'execute', 'delete', 'external_upload'].includes(tag),
    );
    return hasHighRisk ? 35 : 75;
  }

  const overlap = intentTags.filter((tag) => trajectoryTags.has(tag)).length;
  return Math.round((overlap / intentTags.length) * 100);
}

function resolveSeverity(score: number): DivergenceSeverity {
  if (score >= 80) return 'CRITICAL';
  if (score >= 60) return 'HIGH';
  if (score >= 35) return 'MEDIUM';
  return 'LOW';
}

function resolveRecommendation(
  score: number,
  severity: DivergenceSeverity,
  mismatchedSteps: Array<{ tool: string; reason: string }>,
): DivergenceRecommendation {
  if (score >= INTENT_DIVERGENCE_THRESHOLD || severity === 'CRITICAL') {
    return mismatchedSteps.some((step) => /export|delete|external upload/i.test(step.reason))
      ? 'BLOCK_ACTION'
      : 'REVOKE_CAPABILITIES';
  }
  if (score >= 50 || severity === 'HIGH') return 'REVOKE_CAPABILITIES';
  return 'ALLOW';
}

export function analyzeIntentDivergence(
  intent: string,
  trajectory: ToolCallStep[],
): IntentDivergenceReport {
  const intentTags = inferIntentTags(intent);
  const intentMatchScore = computeTagAlignment(intentTags, trajectory);
  const mismatchedSteps: Array<{ tool: string; reason: string }> = [];
  let scoreBoost = 0;

  for (const step of trajectory) {
    const mismatch = analyzeStepAgainstIntent(intent, intentTags, step);
    if (mismatch) {
      mismatchedSteps.push({ tool: mismatch.tool, reason: mismatch.reason });
      scoreBoost += mismatch.scoreBoost;
    }
  }

  const alignmentDivergence = Math.max(0, 100 - intentMatchScore);
  const divergenceScore = Math.min(100, Math.max(alignmentDivergence, Math.round(scoreBoost * 0.85)));

  const severity = resolveSeverity(divergenceScore);
  const recommendation = resolveRecommendation(divergenceScore, severity, mismatchedSteps);
  const shouldBlock = divergenceScore > INTENT_DIVERGENCE_THRESHOLD;

  const violation = shouldBlock
    ? `INTENT_ACTION_DIVERGENCE: ${divergenceScore}% mismatch between user intent and action trajectory`
    : undefined;

  return {
    divergenceScore,
    severity,
    mismatchedSteps,
    recommendation,
    violation,
    shouldBlock,
    intentTags,
    intentMatchScore,
  };
}

export function calculateIntentDivergenceFromSteps(
  intent: string,
  toolNames: string[],
): IntentDivergenceReport {
  return analyzeIntentDivergence(
    intent,
    toolNames.map((tool) => ({ tool })),
  );
}
