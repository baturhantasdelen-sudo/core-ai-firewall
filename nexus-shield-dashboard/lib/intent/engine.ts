import {
  analyzeIntentDivergence as engineAnalyzeIntentDivergence,
  INTENT_DIVERGENCE_THRESHOLD,
  type DivergenceRecommendation,
  type DivergenceSeverity,
} from '@/lib/engine/action-firewall/intent-divergence';
import type {
  DivergenceAction,
  DivergenceRisk,
  IntentAnalysisResult,
  ToolCallStep,
} from '@/lib/intent/types';

/** Normalize locale-specific phrasing so the semantic engine can score accurately. */
function normalizeUserIntent(intent: string): string {
  return intent
    .replace(/faturayı kontrol et/i, 'check invoice')
    .replace(/faturayı incele/i, 'check invoice')
    .replace(/kontrol et/i, 'check')
    .replace(/görüntüle/i, 'view')
    .replace(/dışarı aktar|disari aktar/i, 'export')
    .replace(/müşteri veritabanı|musteri veritabani/i, 'customer database')
    .trim();
}

function mapSeverity(severity: DivergenceSeverity): DivergenceRisk {
  return severity;
}

function mapRecommendation(
  recommendation: DivergenceRecommendation,
  divergencePercent: number,
  severity: DivergenceSeverity,
): DivergenceAction {
  if (
    recommendation === 'BLOCK_ACTION' ||
    (severity === 'CRITICAL' && divergencePercent >= INTENT_DIVERGENCE_THRESHOLD)
  ) {
    return 'CRITICAL_BLOCK';
  }
  if (recommendation === 'REVOKE_CAPABILITIES') return 'REVOKE_CAPABILITIES';
  return 'ALLOW';
}

function computeAlignedDivergence(
  report: ReturnType<typeof engineAnalyzeIntentDivergence>,
  toolCalls: ToolCallStep[],
): number {
  if (report.mismatchedSteps.length > 0) {
    return report.divergenceScore;
  }

  const toolHaystack = toolCalls.map((step) => step.tool.toLowerCase()).join(' ');
  let fitScore = report.intentMatchScore;

  if (report.intentTags.includes('invoice') && /invoice|billing|fatura/.test(toolHaystack)) {
    fitScore = Math.max(fitScore, 100);
  }
  if (report.intentTags.includes('read') && /read|get|fetch|view|lookup|check/.test(toolHaystack)) {
    fitScore = Math.max(fitScore, 100);
  }
  if (report.intentTags.includes('search') && /search|find|query/.test(toolHaystack)) {
    fitScore = Math.max(fitScore, 100);
  }

  return Math.max(0, 100 - fitScore);
}

/**
 * Computes semantic distance between the user's initial prompt (intent)
 * and the agent's planned tool-call trajectory.
 */
export function analyzeIntentDivergence(
  userIntent: string,
  toolCalls: ToolCallStep[],
): IntentAnalysisResult {
  const normalizedIntent = normalizeUserIntent(userIntent);
  const report = engineAnalyzeIntentDivergence(normalizedIntent, toolCalls);

  const divergencePercent = computeAlignedDivergence(report, toolCalls);
  const severity =
    divergencePercent >= 80
      ? 'CRITICAL'
      : divergencePercent >= 60
        ? 'HIGH'
        : divergencePercent >= 35
          ? 'MEDIUM'
          : 'LOW';
  const shouldBlock = divergencePercent > INTENT_DIVERGENCE_THRESHOLD;

  let engineRecommendation: DivergenceRecommendation = 'ALLOW';
  if (shouldBlock) {
    engineRecommendation = 'BLOCK_ACTION';
  } else if (divergencePercent >= 50 || severity === 'HIGH') {
    engineRecommendation = 'REVOKE_CAPABILITIES';
  }

  const recommendation = mapRecommendation(engineRecommendation, divergencePercent, severity);

  return {
    userIntent,
    toolCalls,
    divergencePercent,
    risk: mapSeverity(severity),
    intentTags: report.intentTags,
    intentMatchScore: report.intentMatchScore,
    mismatchedSteps: report.mismatchedSteps,
    recommendation,
    shouldBlock,
    violation: shouldBlock
      ? `INTENT_ACTION_DIVERGENCE: ${divergencePercent}% mismatch between user intent and action trajectory`
      : report.violation,
    analyzedAt: new Date().toISOString(),
  };
}
