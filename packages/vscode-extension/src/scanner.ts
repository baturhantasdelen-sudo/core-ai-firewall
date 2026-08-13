import type { Profile, ScanMatch } from './types';

function lineNumberAt(content: string, index: number): number {
  return content.slice(0, index).split('\n').length;
}

function columnAt(content: string, index: number): number {
  const lastNewline = content.lastIndexOf('\n', index);
  return index - lastNewline;
}

function isValidTckn(value: string): boolean {
  if (!/^[1-9]\d{10}$/.test(value)) return false;
  const digits = value.split('').map(Number);
  const oddSum = digits[0] + digits[2] + digits[4] + digits[6] + digits[8];
  const evenSum = digits[1] + digits[3] + digits[5] + digits[7];
  const digit10 = (((oddSum * 7 - evenSum) % 10) + 10) % 10;
  const digit11 = digits.slice(0, 10).reduce((sum, digit) => sum + digit, 0) % 10;
  return digits[9] === digit10 && digits[10] === digit11;
}

function luhnCheck(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let shouldDouble = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let digit = Number(digits[i]);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

function hasPiiContext(content: string, index: number): boolean {
  const window = content.slice(Math.max(0, index - 60), Math.min(content.length, index + 60)).toLowerCase();
  return /(?:customer|müşteri|user|patient|email|phone|ssn|tckn|iban|tax|identity|billing|kredi|card)/i.test(
    window,
  );
}

function hasSecretContext(content: string, index: number): boolean {
  const window = content.slice(Math.max(0, index - 80), Math.min(content.length, index + 80)).toLowerCase();
  return /(?:api[_-]?key|secret|password|token|auth|credential|private|access[_-]?key|\bkey\s*[=:])/i.test(
    window,
  );
}

interface RuleSpec {
  id: string;
  type: string;
  category: 'pii' | 'secret';
  regex: RegExp;
  profiles: Profile[];
  validate?: (value: string) => boolean;
  contextCheck?: (content: string, index: number) => boolean;
}

const RULES: RuleSpec[] = [
  {
    id: 'tckn',
    type: 'TCKN',
    category: 'pii',
    profiles: ['TR'],
    regex: /\b(?<![\d.])([1-9]\d{10})(?![\d.])\b/g,
    validate: isValidTckn,
    contextCheck: hasPiiContext,
  },
  {
    id: 'tr-iban',
    type: 'TR IBAN',
    category: 'pii',
    profiles: ['TR'],
    regex: /\bTR\d{2}(?:\s?\d{4}){5}\s?\d{2}\b/gi,
    contextCheck: hasPiiContext,
  },
  {
    id: 'vkn',
    type: 'VKN',
    category: 'pii',
    profiles: ['TR'],
    regex: /\b\d{10}\b/g,
    contextCheck: hasPiiContext,
  },
  {
    id: 'credit-card',
    type: 'Credit Card',
    category: 'pii',
    profiles: ['TR', 'US', 'GLOBAL'],
    regex: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
    validate: luhnCheck,
    contextCheck: hasPiiContext,
  },
  {
    id: 'email',
    type: 'Email',
    category: 'pii',
    profiles: ['US', 'GLOBAL'],
    regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    contextCheck: hasPiiContext,
  },
  {
    id: 'openai-api-key',
    type: 'OpenAI API Key',
    category: 'secret',
    profiles: ['TR', 'US', 'GLOBAL'],
    regex: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g,
    contextCheck: hasSecretContext,
  },
  {
    id: 'github-token',
    type: 'GitHub Token',
    category: 'secret',
    profiles: ['TR', 'US', 'GLOBAL'],
    regex: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{20,}\b/g,
    contextCheck: hasSecretContext,
  },
  {
    id: 'stripe-secret-key',
    type: 'Stripe Secret Key',
    category: 'secret',
    profiles: ['TR', 'US', 'GLOBAL'],
    regex: /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}\b/g,
    contextCheck: hasSecretContext,
  },
  {
    id: 'aws-access-key',
    type: 'AWS Access Key',
    category: 'secret',
    profiles: ['TR', 'US', 'GLOBAL'],
    regex: /\b(AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16})\b/g,
    contextCheck: hasSecretContext,
  },
];

function rulesForProfile(profile: Profile): RuleSpec[] {
  return RULES.filter((rule) => rule.profiles.includes(profile));
}

export function scanContentLocal(content: string, filename: string, profile: Profile): ScanMatch[] {
  if (!content.trim()) return [];

  const normalized = filename.replace(/\\/g, '/');
  if (/node_modules|dist|\.next|\.git/.test(normalized)) return [];

  const matches: ScanMatch[] = [];
  const seen = new Set<string>();
  const occupied: Array<[number, number]> = [];

  for (const rule of rulesForProfile(profile)) {
    const regex = new RegExp(rule.regex.source, rule.regex.flags);
    let match: RegExpExecArray | null;

    while ((match = regex.exec(content)) !== null) {
      const matched = match[0];
      const rangeStart = match.index;
      const rangeEnd = match.index + matched.length;

      if (rule.validate && !rule.validate(matched)) continue;
      if (rule.contextCheck && !rule.contextCheck(content, rangeStart)) continue;
      if (occupied.some(([start, end]) => rangeStart < end && start < rangeEnd)) continue;

      const key = `${rule.id}:${rangeStart}:${matched}`;
      if (seen.has(key)) continue;
      seen.add(key);
      occupied.push([rangeStart, rangeEnd]);

      matches.push({
        ruleId: rule.id,
        type: rule.type,
        line: lineNumberAt(content, rangeStart),
        column: columnAt(content, rangeStart),
        matched,
        category: rule.category,
        rangeStart,
        rangeEnd,
      });
    }
  }

  return matches.sort((a, b) => a.rangeStart - b.rangeStart);
}

export function scanContent(
  content: string,
  filename: string,
  profile: Profile,
): ScanMatch[] {
  return scanContentLocal(content, filename, profile);
}
