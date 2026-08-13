import type { DetectorContext, DetectionMatch } from '@/lib/engine/types';
import {
  confidenceFromSignals,
  hasSecretContext,
  isPlaceholder,
  lineNumberAt,
  columnAt,
  maskPreview,
  rangesOverlap,
  severityFor,
  shannonEntropy,
} from '@/lib/engine/utils';

type MatchWithRange = DetectionMatch & { range: [number, number] };

export function collectRegexMatches(params: {
  content: string;
  ctx: DetectorContext;
  ruleId: string;
  type: string;
  category: 'secret' | 'pii';
  regex: RegExp;
  validate?: (match: string) => boolean;
  branded?: boolean;
  contextCheck?: (content: string, index: number) => boolean;
}): MatchWithRange[] {
  const results: MatchWithRange[] = [];
  const regex = new RegExp(params.regex.source, params.regex.flags);
  let match: RegExpExecArray | null;

  while ((match = regex.exec(params.content)) !== null) {
    const matched = match[0];
    if (isPlaceholder(matched)) continue;
    if (params.validate && !params.validate(matched)) continue;

    const entropy = shannonEntropy(matched.replace(/\s+/g, ''));
    const contextual = params.contextCheck?.(params.content, match.index) ?? false;
    const confidence = confidenceFromSignals({
      validated: Boolean(params.validate),
      entropy,
      contextual,
      branded: params.branded,
    });

    results.push({
      ruleId: params.ruleId,
      type: params.type,
      line: lineNumberAt(params.content, match.index),
      column: columnAt(params.content, match.index),
      preview: maskPreview(matched, params.type),
      matched,
      confidence,
      severity: severityFor(params.category, confidence),
      category: params.category,
      entropy,
      range: [match.index, match.index + matched.length],
    });
  }

  return results;
}

const ASSIGNMENT_VALUE_REGEX = /[A-Za-z_][A-Za-z0-9_]*\s*[:=]\s*['"`]([A-Za-z0-9+/_.-]{20,100})['"`]/g;
const PURE_HEX_REGEX = /^[0-9a-f]+$/i;

export function detectHighEntropyInContent(
  content: string,
  ctx: DetectorContext,
  occupiedRanges: Array<[number, number]>,
): MatchWithRange[] {
  const results: MatchWithRange[] = [];
  const regex = new RegExp(ASSIGNMENT_VALUE_REGEX.source, ASSIGNMENT_VALUE_REGEX.flags);
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    const value = match[1];
    const valueStart = match.index + match[0].lastIndexOf(value);
    const valueRange: [number, number] = [valueStart, valueStart + value.length];

    if (isPlaceholder(value)) continue;
    if (PURE_HEX_REGEX.test(value)) continue;
    if (occupiedRanges.some((range) => rangesOverlap(range, valueRange))) continue;

    const entropy = shannonEntropy(value);
    if (entropy < 4.3) continue;

    const contextual = hasSecretContext(content, valueStart);
    const confidence = confidenceFromSignals({ entropy, contextual });

    results.push({
      ruleId: 'high-entropy-secret',
      type: 'High-Entropy Secret',
      line: lineNumberAt(content, valueStart),
      column: columnAt(content, valueStart),
      preview: maskPreview(value, 'High-Entropy Secret'),
      matched: value,
      confidence,
      severity: severityFor('secret', confidence),
      category: 'secret',
      entropy,
      range: valueRange,
    });
  }

  return results;
}