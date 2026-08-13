import type { DetectionMatch, FindingCategory } from '@/lib/engine/types';
import type { NexusShieldPolicy } from '@/lib/engine/policy';
import { lineNumberAt, columnAt } from '@/lib/engine/utils';

export type PiiMaskStyle = 'partial' | 'token';

export interface RemediationFix {
  ruleId: string;
  type: string;
  category: FindingCategory;
  file?: string;
  line: number;
  column: number;
  original: string;
  replacement: string;
  envVarName?: string;
  envExampleLine?: string;
}

export interface RemediationResult {
  content: string;
  fixes: RemediationFix[];
  envExampleAdditions: string[];
}

export interface RemediationFileInput {
  path: string;
  content: string;
  findings: DetectionMatch[];
}

export interface RemediationBatchResult {
  files: Array<{
    path: string;
    content: string;
    originalContent: string;
    fixes: RemediationFix[];
  }>;
  envExampleAdditions: string[];
}

const TOKEN_LABELS: Record<string, string> = {
  tckn: 'MASKED_TCKN',
  'tr-iban': 'MASKED_IBAN',
  'global-iban': 'MASKED_IBAN',
  vkn: 'MASKED_VKN',
  'credit-card': 'MASKED_CARD',
  email: 'MASKED_EMAIL',
  'tr-phone': 'MASKED_PHONE',
  ssn: 'MASKED_SSN',
};

const ENV_VAR_BY_RULE: Record<string, string> = {
  'openai-api-key': 'OPENAI_API_KEY',
  'github-token': 'GITHUB_TOKEN',
  'stripe-secret-key': 'STRIPE_SECRET_KEY',
  'aws-access-key': 'AWS_ACCESS_KEY_ID',
  'gcp-api-key': 'GCP_API_KEY',
  'npm-token': 'NPM_TOKEN',
  'pypi-token': 'PYPI_TOKEN',
  'generic-api-key': 'SECRET_KEY',
  'high-entropy-secret': 'SECRET_KEY',
};

function piiMaskStyle(policy: NexusShieldPolicy): PiiMaskStyle {
  return policy.remediation?.pii_mask_style ?? 'token';
}

function secretUseEnv(policy: NexusShieldPolicy): boolean {
  return policy.remediation?.secret_use_env ?? true;
}

function partialMask(value: string, ruleId: string): string {
  const compact = value.replace(/\s+/g, '');

  if (ruleId === 'tckn' && compact.length === 11) {
    return `${compact.slice(0, 3)}****${compact.slice(-3)}`;
  }

  if (ruleId.includes('iban')) {
    return `${compact.slice(0, 4)}****${compact.slice(-4)}`;
  }

  if (compact.length <= 8) {
    return '*'.repeat(compact.length);
  }

  const visibleTail = compact.slice(-4);
  const prefix = compact.slice(0, Math.min(3, compact.length - 4));
  return `${prefix}****${visibleTail}`;
}

function tokenMask(ruleId: string, type: string): string {
  const label = TOKEN_LABELS[ruleId] ?? `MASKED_${type.toUpperCase().replace(/\s+/g, '_')}`;
  return `[${label}]`;
}

function piiReplacement(finding: DetectionMatch, policy: NexusShieldPolicy): string {
  const style = piiMaskStyle(policy);
  if (style === 'partial') {
    return partialMask(finding.matched, finding.ruleId);
  }
  return tokenMask(finding.ruleId, finding.type);
}

function envVarNameFor(finding: DetectionMatch, lineText: string): string {
  const fromRule = ENV_VAR_BY_RULE[finding.ruleId];
  if (fromRule) return fromRule;

  const varMatch =
    /(?:const|let|var)\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*['"]/.exec(lineText) ??
    /([A-Za-z_][A-Za-z0-9_]*)\s*=\s*['"]/.exec(lineText);

  if (varMatch?.[1]) {
    return varMatch[1].toUpperCase();
  }

  return 'SECRET_KEY';
}

function secretReplacement(
  finding: DetectionMatch,
  content: string,
  index: number,
  policy: NexusShieldPolicy,
): { replacement: string; envVarName?: string; envExampleLine?: string } {
  if (!secretUseEnv(policy)) {
    return { replacement: tokenMask(finding.ruleId, finding.type) };
  }

  const lines = content.split('\n');
  const lineIndex = lineNumberAt(content, index) - 1;
  const lineText = lines[lineIndex] ?? '';
  const envVarName = envVarNameFor(finding, lineText);
  const envRef = `process.env.${envVarName}`;

  const quotedPatterns = [
    new RegExp(`(['"])${escapeRegExp(finding.matched)}\\1`),
    new RegExp(`(\`)${escapeRegExp(finding.matched)}\\1`),
  ];

  for (const pattern of quotedPatterns) {
    if (pattern.test(lineText)) {
      return {
        replacement: envRef,
        envVarName,
        envExampleLine: `${envVarName}=your_${envVarName.toLowerCase()}_here`,
      };
    }
  }

  return {
    replacement: envRef,
    envVarName,
    envExampleLine: `${envVarName}=your_${envVarName.toLowerCase()}_here`,
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

export function buildReplacementForFinding(
  finding: DetectionMatch,
  content: string,
  index: number,
  policy: NexusShieldPolicy,
): { replacement: string; envVarName?: string; envExampleLine?: string } {
  if (finding.category === 'pii') {
    return { replacement: piiReplacement(finding, policy) };
  }
  return secretReplacement(finding, content, index, policy);
}

export function remediateFileContent(
  content: string,
  findings: DetectionMatch[],
  policy: NexusShieldPolicy,
  filename?: string,
): RemediationResult {
  if (findings.length === 0) {
    return { content, fixes: [], envExampleAdditions: [] };
  }

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

  let remediated = content;
  const fixes: RemediationFix[] = [];
  const envExampleSet = new Set<string>();

  for (const { finding, index } of positioned) {
    const built = buildReplacementForFinding(finding, content, index, policy);
    remediated =
      remediated.slice(0, index) +
      built.replacement +
      remediated.slice(index + finding.matched.length);

    if (built.envExampleLine) {
      envExampleSet.add(built.envExampleLine);
    }

    fixes.push({
      ruleId: finding.ruleId,
      type: finding.type,
      category: finding.category,
      file: filename,
      line: finding.line,
      column: finding.column,
      original: finding.matched,
      replacement: built.replacement,
      envVarName: built.envVarName,
      envExampleLine: built.envExampleLine,
    });
  }

  return {
    content: remediated,
    fixes: fixes.reverse(),
    envExampleAdditions: [...envExampleSet],
  };
}

export function remediateFiles(
  files: RemediationFileInput[],
  policy: NexusShieldPolicy,
): RemediationBatchResult {
  const envExampleSet = new Set<string>();
  const results = files.map((file) => {
    const result = remediateFileContent(file.content, file.findings, policy, file.path);
    for (const line of result.envExampleAdditions) {
      envExampleSet.add(line);
    }
    return {
      path: file.path,
      content: result.content,
      originalContent: file.content,
      fixes: result.fixes.map((fix) => ({ ...fix, file: file.path })),
    };
  });

  return {
    files: results.filter((file) => file.fixes.length > 0),
    envExampleAdditions: [...envExampleSet],
  };
}

export function buildLineDiff(originalLine: string, fixedLine: string): string {
  if (originalLine === fixedLine) return fixedLine;
  return `- ${originalLine}\n+ ${fixedLine}`;
}

export function applyFixToLine(content: string, fix: RemediationFix): string {
  const lines = content.split('\n');
  const lineIndex = fix.line - 1;
  const line = lines[lineIndex];
  if (!line) return content;

  const columnIndex = fix.column - 1;
  if (line.slice(columnIndex, columnIndex + fix.original.length) === fix.original) {
    lines[lineIndex] =
      line.slice(0, columnIndex) + fix.replacement + line.slice(columnIndex + fix.original.length);
    return lines.join('\n');
  }

  lines[lineIndex] = line.replace(fix.original, fix.replacement);
  return lines.join('\n');
}

export function previewFixOnContent(content: string, fix: RemediationFix): {
  originalLine: string;
  fixedLine: string;
  diff: string;
} {
  const lines = content.split('\n');
  const lineIndex = fix.line - 1;
  const originalLine = lines[lineIndex] ?? fix.original;
  const fixedContent = applyFixToLine(content, fix);
  const fixedLine = fixedContent.split('\n')[lineIndex] ?? originalLine;

  return {
    originalLine,
    fixedLine,
    diff: buildLineDiff(originalLine, fixedLine),
  };
}

export function inferMatchedFromPreview(preview: string, ruleId: string): string | null {
  if (!preview.includes('*') && !preview.includes('[')) {
    return preview;
  }

  if (ruleId === 'tckn' && /^\d{3}\*{4,}\d{3,4}$/.test(preview.replace(/\s/g, ''))) {
    return null;
  }

  return null;
}

export function buildPreviewFromFinding(
  finding: DetectionMatch,
  policy: NexusShieldPolicy,
  sampleLine?: string,
): { originalLine: string; fixedLine: string; diff: string; fix: RemediationFix } {
  const lineContent =
    sampleLine ??
    `const value = "${finding.matched}";`;

  const index = resolveMatchIndex(lineContent, finding);
  const built = buildReplacementForFinding(finding, lineContent, index, policy);
  const fix: RemediationFix = {
    ruleId: finding.ruleId,
    type: finding.type,
    category: finding.category,
    line: finding.line,
    column: finding.column,
    original: finding.matched,
    replacement: built.replacement,
    envVarName: built.envVarName,
    envExampleLine: built.envExampleLine,
  };

  const preview = previewFixOnContent(lineContent, fix);
  return { ...preview, fix };
}

export function columnAtEnd(content: string, index: number, length: number): number {
  return columnAt(content, index) + length;
}
