// Kept in sync with `nexus-shield-action/src/scanner.ts` (the public GitHub
// Action). Duplicated here because the two live in separate npm packages;
// if you change detection logic in one, mirror it in the other.

export type IssueType =
  | 'TCKN'
  | 'Credit Card'
  | 'Email'
  | 'OpenAI API Key'
  | 'Anthropic API Key'
  | 'Vercel Token'
  | 'AWS Access Key'
  | 'Private Key'
  | 'JWT'
  | 'Generic Secret';

export interface ScanIssue {
  type: IssueType;
  line: number;
  column: number;
  preview: string;
  matched: string;
}

export interface ScanPattern {
  type: IssueType;
  regex: RegExp;
  validate?: (match: string) => boolean;
}

const TCKN_REGEX = /\b(?<![\d.])([1-9]\d{10})(?![\d.])\b/g;

const CREDIT_CARD_REGEX =
  /\b(?:(?:4\d{3}|5[1-5]\d{2}|3[47]\d{2}|6(?:011|5\d{2}))[\s-]?){3}(?:\d{4}|\d{3}[\s-]?\d{4})\b/g;

const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

const OPENAI_KEY_REGEX = /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g;
const ANTHROPIC_KEY_REGEX = /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g;
const VERCEL_TOKEN_REGEX = /\bvercel_[A-Za-z0-9_-]{20,}\b/g;
const AWS_KEY_REGEX = /\bAKIA[0-9A-Z]{16}\b/g;
const PRIVATE_KEY_REGEX = /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g;
const JWT_REGEX = /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g;

const GENERIC_SECRET_REGEX =
  /\b(?:api[_-]?key|secret|password|token|auth[_-]?token)\s*[:=]\s*['"]?[A-Za-z0-9_\-./+=]{8,}['"]?/gi;

const EXCLUDED_FILENAME_PATTERNS = [
  /\.env\.example$/i,
  /\.env\.sample$/i,
  /\.env\.template$/i,
  /\.env\.local\.example$/i,
  /(?:^|\/)__(?:tests?|mocks?)__\//i,
  /(?:^|\/)fixtures?\//i,
  /(?:^|\/)snapshots?\//i,
  /\.(?:test|spec)\.[jt]sx?$/i,
  /(?:^|\/)mock[s]?\./i,
  /(?:^|\/)README\.md$/i,
];

const ALWAYS_SCAN_PATTERNS = [/\.env$/i, /\.env\.local$/i, /\.env\.production$/i];

const PLACEHOLDER_VALUES = new Set([
  'your_api_key_here',
  'your_openai_api_key_here',
  'your_client_secret_here',
  'replace_with_strong_random_secret',
  'example',
  'changeme',
  'placeholder',
  'xxx',
  'xxxx',
  'xxxxxxxx',
]);

function isExcludedFile(filename: string): boolean {
  if (ALWAYS_SCAN_PATTERNS.some((pattern) => pattern.test(filename))) {
    return false;
  }

  return EXCLUDED_FILENAME_PATTERNS.some((pattern) => pattern.test(filename));
}

function isPlaceholder(value: string): boolean {
  const normalized = value.toLowerCase().replace(/['"]/g, '').trim();
  if (PLACEHOLDER_VALUES.has(normalized)) {
    return true;
  }

  return /^(?:your_|replace_|changeme|example|placeholder|xxx+|<[^>]+>|\*\*\*)$/i.test(normalized);
}

function isValidTckn(value: string): boolean {
  if (!/^[1-9]\d{10}$/.test(value)) {
    return false;
  }

  const digits = value.split('').map(Number);
  const oddSum = digits[0] + digits[2] + digits[4] + digits[6] + digits[8];
  const evenSum = digits[1] + digits[3] + digits[5] + digits[7];
  const digit10 = (((oddSum * 7 - evenSum) % 10) + 10) % 10;
  const digit11 = digits.slice(0, 10).reduce((sum, digit) => sum + digit, 0) % 10;

  return digits[9] === digit10 && digits[10] === digit11;
}

function luhnCheck(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) {
    return false;
  }

  let sum = 0;
  let shouldDouble = false;

  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let digit = Number(digits[i]);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }

  return sum % 10 === 0;
}

function lineNumberAt(content: string, index: number): number {
  return content.slice(0, index).split('\n').length;
}

function columnAt(content: string, index: number): number {
  const lastNewline = content.lastIndexOf('\n', index);
  return index - lastNewline;
}

export function maskPreview(value: string, type: IssueType): string {
  const compact = value.replace(/\s+/g, '');

  if (type === 'Private Key') {
    return '-----BEGIN PRIVATE KEY-----****';
  }

  if (compact.length <= 8) {
    return '*'.repeat(compact.length);
  }

  const visibleTail = compact.slice(-4);
  const prefix = compact.slice(0, Math.min(7, compact.length - 4));
  return `${prefix}${'*'.repeat(Math.max(4, compact.length - prefix.length - 4))}${visibleTail}`;
}

function collectMatches(content: string, pattern: ScanPattern, issues: ScanIssue[], seen: Set<string>): void {
  const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    const matched = match[0];
    if (isPlaceholder(matched)) {
      continue;
    }

    if (pattern.validate && !pattern.validate(matched)) {
      continue;
    }

    const dedupeKey = `${pattern.type}:${match.index}:${matched}`;
    if (seen.has(dedupeKey)) {
      continue;
    }
    seen.add(dedupeKey);

    issues.push({
      type: pattern.type,
      line: lineNumberAt(content, match.index),
      column: columnAt(content, match.index),
      preview: maskPreview(matched, pattern.type),
      matched,
    });
  }
}

const PATTERNS: ScanPattern[] = [
  { type: 'TCKN', regex: TCKN_REGEX, validate: isValidTckn },
  { type: 'Credit Card', regex: CREDIT_CARD_REGEX, validate: luhnCheck },
  { type: 'Email', regex: EMAIL_REGEX },
  { type: 'OpenAI API Key', regex: OPENAI_KEY_REGEX },
  { type: 'Anthropic API Key', regex: ANTHROPIC_KEY_REGEX },
  { type: 'Vercel Token', regex: VERCEL_TOKEN_REGEX },
  { type: 'AWS Access Key', regex: AWS_KEY_REGEX },
  { type: 'Private Key', regex: PRIVATE_KEY_REGEX },
  { type: 'JWT', regex: JWT_REGEX },
  { type: 'Generic Secret', regex: GENERIC_SECRET_REGEX },
];

export function scanContent(content: string, filename: string): ScanIssue[] {
  if (!content.trim()) {
    return [];
  }

  if (isExcludedFile(filename)) {
    return [];
  }

  const issues: ScanIssue[] = [];
  const seen = new Set<string>();

  for (const pattern of PATTERNS) {
    collectMatches(content, pattern, issues, seen);
  }

  return issues.sort((a, b) => a.line - b.line || a.column - b.column);
}
