import type { TrajectoryEntry } from './trajectory';

export interface IntentDivergenceResult {
  divergencePercent: number;
  intentMatchScore: number;
  violation?: string;
  shouldBlock: boolean;
  intentTags: string[];
  trajectoryTags: string[];
}

const INTENT_KEYWORDS: Record<string, RegExp[]> = {
  invoice: [/invoice/i, /billing/i, /receipt/i, /fatura/i],
  read: [/\bread\b/i, /\bview\b/i, /\bcheck\b/i, /\binspect\b/i, /\blookup\b/i],
  export: [/\bexport\b/i, /\bdownload\b/i, /\bdump\b/i, /\bextract\b/i],
  payment: [/\bpay\b/i, /\btransfer\b/i, /\bcharge\b/i, /\brefund\b/i],
  search: [/\bsearch\b/i, /\bfind\b/i, /\blookup\b/i],
  execute: [/\brun\b/i, /\bexecute\b/i, /\bdeploy\b/i, /\brestart\b/i],
  database: [/\bdatabase\b/i, /\bsql\b/i, /\bquery\b/i, /\bdb\b/i, /\brecord\b/i],
};

const TRAJECTORY_TAG_MAP: Array<{ pattern: RegExp; tag: string }> = [
  { pattern: /read_invoice|invoice_read|get_invoice/i, tag: 'invoice' },
  { pattern: /read_db|db_read|sql_query|db_query|database/i, tag: 'database' },
  { pattern: /export_csv|bulk_export|export_db|dump|download/i, tag: 'export' },
  { pattern: /stripe|payment|transfer|financial|billing/i, tag: 'payment' },
  { pattern: /exec|shell|run_command|subprocess/i, tag: 'execute' },
  { pattern: /read_file|fetch_|get_|load_/i, tag: 'read' },
  { pattern: /search|web_search|browse/i, tag: 'search' },
];

export const INTENT_DIVERGENCE_THRESHOLD = 80;

function normalizeForTokenMatch(text: string): string {
  return text.replace(/_/g, ' ');
}

export function inferIntentTags(userIntent: string): string[] {
  const intent = normalizeForTokenMatch(userIntent.toLowerCase());
  return Object.entries(INTENT_KEYWORDS)
    .filter(([, patterns]) => patterns.some((pattern) => pattern.test(intent)))
    .map(([tag]) => tag);
}

function extractTrajectoryTags(trajectory: TrajectoryEntry[] | string[]): string[] {
  const toolNames =
    typeof trajectory[0] === 'string'
      ? (trajectory as string[])
      : (trajectory as TrajectoryEntry[]).map((entry) => entry.toolName);

  const tags = new Set<string>();
  for (const toolName of toolNames) {
    for (const mapping of TRAJECTORY_TAG_MAP) {
      if (mapping.pattern.test(toolName)) {
        tags.add(mapping.tag);
      }
    }
  }
  return [...tags];
}

function computeAlignment(intentTags: string[], trajectoryTags: string[]): number {
  if (intentTags.length === 0) {
    return trajectoryTags.length === 0 ? 100 : 40;
  }
  const overlap = intentTags.filter((tag) => trajectoryTags.includes(tag));
  return Math.round((overlap.length / intentTags.length) * 100);
}

export function calculateIntentDivergence(
  intent: string,
  trajectory: TrajectoryEntry[] | string[],
): IntentDivergenceResult {
  const intentTags = inferIntentTags(intent);
  const trajectoryTags = extractTrajectoryTags(trajectory);
  const intentMatchScore = computeAlignment(intentTags, trajectoryTags);
  const divergencePercent = Math.max(0, 100 - intentMatchScore);

  const exportWithoutIntent =
    trajectoryTags.includes('export') && !intentTags.includes('export') && intentTags.includes('read');
  const paymentWithoutIntent =
    trajectoryTags.includes('payment') && !intentTags.includes('payment');
  const executeWithoutIntent =
    trajectoryTags.includes('execute') && !intentTags.includes('execute');

  let violation: string | undefined;
  if (divergencePercent > INTENT_DIVERGENCE_THRESHOLD) {
    violation = `INTENT_ACTION_DIVERGENCE: ${divergencePercent}% mismatch between user intent and action trajectory`;
  } else if (exportWithoutIntent) {
    violation = `INTENT_ACTION_DIVERGENCE: read intent vs export trajectory (${divergencePercent}% divergence)`;
  } else if (paymentWithoutIntent && divergencePercent > 50) {
    violation = `INTENT_ACTION_DIVERGENCE: non-financial intent vs payment trajectory (${divergencePercent}% divergence)`;
  } else if (executeWithoutIntent && divergencePercent > 50) {
    violation = `INTENT_ACTION_DIVERGENCE: non-execute intent vs shell trajectory (${divergencePercent}% divergence)`;
  }

  const shouldBlock = divergencePercent > INTENT_DIVERGENCE_THRESHOLD;

  return {
    divergencePercent,
    intentMatchScore,
    violation: shouldBlock
      ? (violation ?? `INTENT_ACTION_DIVERGENCE: ${divergencePercent}% mismatch between user intent and action trajectory`)
      : undefined,
    shouldBlock,
    intentTags,
    trajectoryTags,
  };
}

export function scoreIntentConsistency(
  userIntent: string,
  toolCall: { name: string; args: Record<string, unknown> },
): { intentMatchScore: number; violations: string[]; riskBoost: number } {
  const intent = normalizeForTokenMatch(userIntent.toLowerCase());
  const tool = normalizeForTokenMatch(toolCall.name.toLowerCase());
  const argsText = normalizeForTokenMatch(JSON.stringify(toolCall.args).toLowerCase());
  const violations: string[] = [];
  let riskBoost = 0;

  const intentTags = inferIntentTags(userIntent);
  const toolTags = Object.entries(INTENT_KEYWORDS)
    .filter(([, patterns]) => patterns.some((pattern) => pattern.test(`${tool} ${argsText}`)))
    .map(([tag]) => tag);

  const overlap = intentTags.filter((tag) => toolTags.includes(tag));
  const intentMatchScore =
    intentTags.length === 0
      ? toolTags.length === 0
        ? 75
        : 45
      : Math.round((overlap.length / intentTags.length) * 100);

  const invoiceLike = /invoice|billing|receipt|fatura/i.test(intent);
  const exportLike = /bulk_export|export_db|dump|download_all|sql_export/i.test(tool);
  const paymentLike = /payment|transfer|stripe|charge|refund/i.test(tool);
  const executeLike = /exec|shell|run_command|subprocess/i.test(tool);
  const readLikeIntent = /\bcheck\b|\bview\b|\binspect\b|\blookup\b|\bread\b/i.test(intent);

  if (invoiceLike && exportLike) {
    violations.push('Intent-Action mismatch: invoice check intent vs bulk database export tool');
    riskBoost += 35;
  }

  if (readLikeIntent && (exportLike || executeLike)) {
    violations.push('Intent-Action mismatch: read/check intent vs destructive or export tool call');
    riskBoost += 25;
  }

  if (invoiceLike && paymentLike && !/pay|charge|refund/i.test(intent)) {
    violations.push('Intent-Action mismatch: invoice review intent vs financial mutation tool');
    riskBoost += 30;
  }

  if (intentMatchScore < 35) {
    violations.push(`Low intent-tool alignment score (${intentMatchScore}/100)`);
    riskBoost += 20;
  }

  return { intentMatchScore, violations, riskBoost };
}
