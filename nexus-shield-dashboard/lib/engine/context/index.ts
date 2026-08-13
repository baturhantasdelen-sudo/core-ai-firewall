import type { DetectionMatch } from '@/lib/engine/types';
import type { SecretValidationResult } from '@/lib/engine/validation/types';
import type { RemediationFix } from '@/lib/engine/remediation';
import { shannonEntropy } from '@/lib/engine/utils';

export interface ContextAnalysisResult {
  confidenceScore: number;
  isFalsePositive: boolean;
  suppressionReason: string | null;
  suppressed: boolean;
}

export interface ContextAwareFinding extends DetectionMatch, ContextAnalysisResult {
  file?: string;
  fix?: RemediationFix;
  validation?: SecretValidationResult;
}

export interface AnalyzeFindingContextInput {
  finding: DetectionMatch;
  content: string;
  filename: string;
  validation?: SecretValidationResult | null;
}

const MOCK_CONTEXT_PATTERN =
  /\b(?:mock|dummy|test|sample|placeholder|fake|example|fixture|stub|sandbox|demo)(?:[_-]?[a-z0-9_]*)?\b/i;

const FILE_PATH_SUPPRESSION_PATTERN =
  /(?:^|[/\\])(?:.*(?:test|spec|mock|fixture|vendor).*|[\w.-]*\.env\.example|[\w.-]*\.env\.test)(?:[/\\]|$)/i;

const FALSE_POSITIVE_THRESHOLD = 0.35;
const HIGH_ENTROPY_THRESHOLD = 4.3;

function clampScore(score: number): number {
  return Math.min(1, Math.max(0, score));
}

function baseScoreFromConfidence(confidence: DetectionMatch['confidence']): number {
  switch (confidence) {
    case 'HIGH':
      return 0.68;
    case 'MEDIUM':
      return 0.54;
    default:
      return 0.4;
  }
}

function lineAt(content: string, lineNumber: number): string {
  const lines = content.split('\n');
  return lines[lineNumber - 1] ?? '';
}

function resolveLineIndex(content: string, finding: DetectionMatch): number {
  const lines = content.split('\n');
  const lineIndex = finding.line - 1;
  const line = lines[lineIndex];
  if (!line) return -1;

  const columnIndex = finding.column - 1;
  if (line.slice(columnIndex, columnIndex + finding.matched.length) === finding.matched) {
    return lineIndex;
  }

  const fallbackIndex = line.indexOf(finding.matched);
  return fallbackIndex >= 0 ? lineIndex : lineIndex;
}

function extractVariableContext(content: string, finding: DetectionMatch): string {
  const line = lineAt(content, finding.line);
  const lineIndex = resolveLineIndex(content, finding);
  const lines = content.split('\n');
  const prevLine = lineIndex > 0 ? lines[lineIndex - 1] : '';

  const columnIndex = Math.max(0, finding.column - 1);
  const beforeMatch = line.slice(0, columnIndex);
  const identifierMatch =
    /(?:const|let|var|export|key|token|secret|password|api[_-]?key|credential)\s+([A-Za-z_][A-Za-z0-9_]*)/.exec(
      beforeMatch,
    ) ?? /([A-Za-z_][A-Za-z0-9_]*)\s*=\s*['"`]?$/.exec(beforeMatch);

  const identifier = identifierMatch?.[1] ?? '';
  return `${identifier} ${line} ${prevLine}`.trim();
}

function checkVariableNameContext(content: string, finding: DetectionMatch): string | null {
  const contextWindow = extractVariableContext(content, finding);
  const match = MOCK_CONTEXT_PATTERN.exec(contextWindow);
  if (!match) return null;

  const token = match[0];
  return `Identified as test mock data due to variable naming '${token}'`;
}

function checkFilePathContext(filename: string): string | null {
  const normalized = filename.replace(/\\/g, '/');

  if (/\.env\.example$/i.test(normalized)) {
    return 'File path indicates placeholder environment template (.env.example)';
  }
  if (/\.env\.test$/i.test(normalized)) {
    return 'File path indicates test environment template (.env.test)';
  }
  if (/(?:^|\/)vendor(?:\/|$)/i.test(normalized)) {
    return 'Finding located in vendor/third-party path';
  }
  if (/(?:^|\/)fixtures?(?:\/|$)/i.test(normalized) || /fixture/i.test(normalized)) {
    return 'File path indicates fixture/test data directory';
  }
  if (/(?:^|\/)(?:[^/]*(?:test|spec|mock)[^/]*)(?:\/|$)/i.test(normalized)) {
    return 'File path indicates test or mock source file';
  }
  if (FILE_PATH_SUPPRESSION_PATTERN.test(normalized)) {
    return 'File path context suggests non-production test data';
  }

  return null;
}

function checkEntropyAndValidationBoost(
  finding: DetectionMatch,
  validation?: SecretValidationResult | null,
): boolean {
  const entropy = finding.entropy ?? shannonEntropy(finding.matched);
  return entropy >= HIGH_ENTROPY_THRESHOLD && validation?.status === 'ACTIVE';
}

export function analyzeFindingContext(input: AnalyzeFindingContextInput): ContextAnalysisResult {
  const { finding, content, filename, validation } = input;

  let score = baseScoreFromConfidence(finding.confidence);
  const reasons: string[] = [];

  const variableReason = checkVariableNameContext(content, finding);
  if (variableReason) {
    score -= 0.45;
    reasons.push(variableReason);
  }

  const pathReason = checkFilePathContext(filename);
  if (pathReason) {
    score -= 0.35;
    reasons.push(pathReason);
  }

  if (checkEntropyAndValidationBoost(finding, validation)) {
    score += 0.3;
    reasons.push('High entropy secret with active live verification — elevated confidence');
  }

  score = clampScore(score);
  const isFalsePositive = score < FALSE_POSITIVE_THRESHOLD;
  const suppressionReason = isFalsePositive
    ? reasons.filter((reason) => !reason.includes('elevated confidence')).join('; ') ||
      'Context heuristics indicate likely false positive'
    : null;

  return {
    confidenceScore: score,
    isFalsePositive,
    suppressionReason,
    suppressed: isFalsePositive,
  };
}

export function applyContextToFinding(
  finding: DetectionMatch,
  content: string,
  filename: string,
  validation?: SecretValidationResult | null,
): ContextAwareFinding {
  const context = analyzeFindingContext({ finding, content, filename, validation });
  return { ...finding, ...context };
}

export function applyContextToFindings(
  findings: DetectionMatch[],
  content: string,
  filename: string,
  options?: {
    includeSuppressed?: boolean;
    validationByMatch?: Map<string, SecretValidationResult>;
  },
): ContextAwareFinding[] {
  const enriched = findings.map((finding) => {
    const validationKey = `${finding.ruleId}:${finding.line}:${finding.matched}`;
    const validation = options?.validationByMatch?.get(validationKey);
    return applyContextToFinding(finding, content, filename, validation);
  });

  if (options?.includeSuppressed) {
    return enriched;
  }

  return enriched.filter((finding) => !finding.suppressed);
}

export function partitionFindingsByContext(findings: ContextAwareFinding[]): {
  active: ContextAwareFinding[];
  suppressed: ContextAwareFinding[];
} {
  return {
    active: findings.filter((finding) => !finding.suppressed),
    suppressed: findings.filter((finding) => finding.suppressed),
  };
}

export function finalizeFindingsContext(
  findings: DetectionMatch[],
  fileContentByPath: Map<string, string>,
  validationByKey?: Map<string, SecretValidationResult>,
): ContextAwareFinding[] {
  return findings.map((finding) => {
    const file = (finding as DetectionMatch & { file?: string }).file ?? 'unknown';
    const content = fileContentByPath.get(file) ?? '';
    const validationKey = `${finding.ruleId}:${finding.line}:${finding.matched}`;
    const validation = validationByKey?.get(validationKey);
    return applyContextToFinding(finding, content, file, validation);
  });
}
