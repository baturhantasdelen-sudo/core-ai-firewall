import type { TrajectoryEntry } from './trajectory';
import {
  analyzeIntentDivergence,
  inferIntentTags,
  INTENT_DIVERGENCE_THRESHOLD,
  type IntentDivergenceReport,
  type ToolCallStep,
} from './intent-divergence';

export type { IntentDivergenceReport, ToolCallStep, DivergenceSeverity, DivergenceRecommendation } from './intent-divergence';
export { analyzeIntentDivergence, inferIntentTags, INTENT_DIVERGENCE_THRESHOLD } from './intent-divergence';

export interface IntentDivergenceResult {
  divergencePercent: number;
  intentMatchScore: number;
  violation?: string;
  shouldBlock: boolean;
  intentTags: string[];
  trajectoryTags: string[];
  report?: IntentDivergenceReport;
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

function normalizeForTokenMatch(text: string): string {
  return text.replace(/_/g, ' ');
}

function toToolCallSteps(trajectory: TrajectoryEntry[] | string[]): ToolCallStep[] {
  if (trajectory.length === 0) return [];
  if (typeof trajectory[0] === 'string') {
    return (trajectory as string[]).map((tool) => ({ tool }));
  }
  return (trajectory as TrajectoryEntry[]).map((entry) => ({
    tool: entry.toolName,
    timestamp: entry.timestamp,
  }));
}

export function calculateIntentDivergence(
  intent: string,
  trajectory: TrajectoryEntry[] | string[],
): IntentDivergenceResult {
  const steps = toToolCallSteps(trajectory);
  const report = analyzeIntentDivergence(intent, steps);

  const trajectoryTags = [...new Set(steps.map((step) => step.tool))];

  return {
    divergencePercent: report.divergenceScore,
    intentMatchScore: report.intentMatchScore,
    violation: report.violation,
    shouldBlock: report.shouldBlock,
    intentTags: report.intentTags,
    trajectoryTags,
    report,
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
  const exportLike = /bulk_export|export_db|dump|download_all|sql_export|export_customer_database/i.test(tool);
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
