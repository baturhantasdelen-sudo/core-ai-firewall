import type { DetectionMatch, Profile } from '@/lib/engine/types';
import { globalPiiDetectors } from '@/lib/engine/detectors/pii';
import { loadPolicyFromObject, type NexusShieldPolicy } from '@/lib/engine/policy';
import { runDetectionEngine } from '@/lib/engine/index';
import { isValidTckn, lineNumberAt, columnAt, hasPiiContext } from '@/lib/engine/utils';

const SANDBOX_EXTRA_PII = globalPiiDetectors.filter((detector) =>
  ['credit-card', 'email'].includes(detector.id),
);

const REDACTION_LABELS: Record<string, string> = {
  tckn: 'TCKN_MASKED',
  'credit-card': 'CARD_MASKED',
  'tr-iban': 'IBAN_MASKED',
  'global-iban': 'IBAN_MASKED',
  email: 'EMAIL_MASKED',
  'tr-phone': 'PHONE_MASKED',
  ssn: 'SSN_MASKED',
  vkn: 'VKN_MASKED',
  'openai-api-key': 'SECRET_MASKED',
  'aws-access-key': 'SECRET_MASKED',
  'gcp-api-key': 'SECRET_MASKED',
  'stripe-secret-key': 'SECRET_MASKED',
  'github-token': 'SECRET_MASKED',
  'npm-token': 'SECRET_MASKED',
  'pypi-token': 'SECRET_MASKED',
  'generic-api-key': 'SECRET_MASKED',
  'high-entropy-secret': 'SECRET_MASKED',
};

function sandboxDetectorContext(profile: Profile) {
  return {
    filename: 'playground.txt',
    profile,
    allowlistExact: new Set<string>(),
    allowlistPatterns: [] as RegExp[],
    ignorePaths: [] as string[],
  };
}

function hasSandboxPiiFallbackContext(content: string, index: number): boolean {
  const windowStart = Math.max(0, index - 80);
  const windowEnd = Math.min(content.length, index + 80);
  const window = content.slice(windowStart, windowEnd).toLowerCase();

  return /(?:tckn|kredi\s*kart[ıi]|credit\s*card|\bcard\b|ssn|iban|phone|email|customer|user|patient|identity|billing|müşteri)/i.test(
    window,
  );
}

function runSandboxExtraDetectors(content: string, profile: Profile): DetectionMatch[] {
  const ctx = sandboxDetectorContext(profile);
  return SANDBOX_EXTRA_PII.flatMap((detector) => detector.detect(content, ctx));
}

function runFallbackPiiDetectors(content: string): DetectionMatch[] {
  const findings: DetectionMatch[] = [];

  const tcknRegex = /\b(?<![\d.])([1-9]\d{10})(?![\d.])\b/g;
  let match: RegExpExecArray | null;
  while ((match = tcknRegex.exec(content)) !== null) {
    const matched = match[0];
    if (isValidTckn(matched)) continue;
    if (!hasSandboxPiiFallbackContext(content, match.index) && !hasPiiContext(content, match.index)) {
      continue;
    }

    findings.push({
      ruleId: 'tckn',
      type: 'TCKN',
      line: lineNumberAt(content, match.index),
      column: columnAt(content, match.index),
      preview: matched.slice(0, 3) + '****' + matched.slice(-4),
      matched,
      confidence: 'MEDIUM',
      severity: 'medium',
      category: 'pii',
    });
  }

  const cardPatterns = [
    /\b(?:(?:4\d{3}|5[1-5]\d{2}|3[47]\d{2}|6(?:011|5\d{2}))[\s-]?){3}(?:\d{4}|\d{3}[\s-]?\d{4})\b/g,
    /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
  ];

  for (const cardRegex of cardPatterns) {
    while ((match = cardRegex.exec(content)) !== null) {
      const matched = match[0];
      if (findings.some((f) => f.matched === matched && f.ruleId === 'credit-card')) continue;
      if (!hasSandboxPiiFallbackContext(content, match.index) && !hasPiiContext(content, match.index)) {
        continue;
      }

      findings.push({
        ruleId: 'credit-card',
        type: 'Credit Card',
        line: lineNumberAt(content, match.index),
        column: columnAt(content, match.index),
        preview: matched.slice(0, 4) + '****' + matched.slice(-4),
        matched,
        confidence: 'MEDIUM',
        severity: 'medium',
        category: 'pii',
      });
    }
  }

  return findings;
}

function dedupeFindings(findings: DetectionMatch[]): DetectionMatch[] {
  const seen = new Set<string>();
  const unique: DetectionMatch[] = [];

  for (const finding of findings) {
    const key = `${finding.ruleId}:${finding.line}:${finding.column}:${finding.matched}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(finding);
  }

  return unique.sort((a, b) => a.line - b.line || a.column - b.column);
}

function mergeSandboxFindings(content: string, policy: NexusShieldPolicy): DetectionMatch[] {
  const engineFindings = runDetectionEngine(content, 'playground.txt', policy);
  const extraFindings = runSandboxExtraDetectors(content, policy.profile);
  const fallbackFindings = runFallbackPiiDetectors(content);

  return dedupeFindings([...engineFindings, ...extraFindings, ...fallbackFindings]);
}

function indexFromLineColumn(content: string, line: number, column: number): number {
  const lines = content.split('\n');
  let index = 0;
  for (let i = 0; i < line - 1; i += 1) {
    index += lines[i].length + 1;
  }
  return index + column - 1;
}

function resolveMatchIndex(content: string, finding: DetectionMatch): number {
  const preferred = indexFromLineColumn(content, finding.line, finding.column);
  if (content.slice(preferred, preferred + finding.matched.length) === finding.matched) {
    return preferred;
  }

  let searchFrom = 0;
  while (searchFrom < content.length) {
    const found = content.indexOf(finding.matched, searchFrom);
    if (found === -1) break;
    if (lineNumberAt(content, found) === finding.line) return found;
    searchFrom = found + 1;
  }

  return content.indexOf(finding.matched);
}

function redactionLabel(finding: DetectionMatch): string {
  return (
    REDACTION_LABELS[finding.ruleId] ??
    `${finding.type.toUpperCase().replace(/\s+/g, '_')}_MASKED`
  );
}

function redactContent(content: string, findings: DetectionMatch[]): string {
  const positioned = findings
    .map((finding) => ({
      finding,
      index: resolveMatchIndex(content, finding),
    }))
    .filter(
      ({ index, finding }) =>
        index >= 0 && content.slice(index, index + finding.matched.length) === finding.matched,
    )
    .sort((a, b) => b.index - a.index);

  let redacted = content;
  for (const { finding, index } of positioned) {
    const token = `[${redactionLabel(finding)}]`;
    redacted = redacted.slice(0, index) + token + redacted.slice(index + finding.matched.length);
  }

  return redacted;
}

export interface SandboxSanitizeResult {
  sanitizedPrompt: string;
  redacted_input: string;
  sanitized_prompt: string;
  pii_detected: boolean;
  masked_types: string[];
  pii_masked_count: number;
  findings: DetectionMatch[];
  latency_ms: number;
}

export function sanitizePlaygroundInput(
  input: string,
  options?: { profile?: Profile; policy?: Record<string, unknown> | null },
): SandboxSanitizeResult {
  const started = performance.now();
  const policy = loadPolicyFromObject({
    version: 1,
    profile: options?.profile ?? 'TR',
    ...(options?.policy ?? {}),
  });

  const findings = mergeSandboxFindings(input, policy);
  const sanitizedPrompt = findings.length > 0 ? redactContent(input, findings) : input;
  const maskedTypes = [...new Set(findings.map((finding) => finding.type))];

  return {
    sanitizedPrompt,
    redacted_input: sanitizedPrompt,
    sanitized_prompt: sanitizedPrompt,
    pii_detected: findings.length > 0,
    masked_types: maskedTypes,
    pii_masked_count: findings.length,
    findings,
    latency_ms: performance.now() - started,
  };
}
