import type { Confidence, Severity } from '@/lib/engine/types';

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

export function shannonEntropy(value: string): number {
  const frequencies = new Map<string, number>();
  for (const char of value) {
    frequencies.set(char, (frequencies.get(char) ?? 0) + 1);
  }

  let entropy = 0;
  for (const count of frequencies.values()) {
    const probability = count / value.length;
    entropy -= probability * Math.log2(probability);
  }

  return entropy;
}

export function isPlaceholder(value: string): boolean {
  const normalized = value.toLowerCase().replace(/['"]/g, '').trim();
  if (PLACEHOLDER_VALUES.has(normalized)) return true;
  return /^(?:your_|replace_|changeme|example|placeholder|xxx+|<[^>]+>|\*\*\*)$/i.test(normalized);
}

export function isValidTckn(value: string): boolean {
  if (!/^[1-9]\d{10}$/.test(value)) return false;

  const digits = value.split('').map(Number);
  const oddSum = digits[0] + digits[2] + digits[4] + digits[6] + digits[8];
  const evenSum = digits[1] + digits[3] + digits[5] + digits[7];
  const digit10 = (((oddSum * 7 - evenSum) % 10) + 10) % 10;
  const digit11 = digits.slice(0, 10).reduce((sum, digit) => sum + digit, 0) % 10;

  return digits[9] === digit10 && digits[10] === digit11;
}

export function luhnCheck(value: string): boolean {
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

export function lineNumberAt(content: string, index: number): number {
  return content.slice(0, index).split('\n').length;
}

export function columnAt(content: string, index: number): number {
  const lastNewline = content.lastIndexOf('\n', index);
  return index - lastNewline;
}

export function maskPreview(value: string, type: string): string {
  const compact = value.replace(/\s+/g, '');

  if (type.includes('Private Key')) {
    return '-----BEGIN PRIVATE KEY-----****';
  }

  if (compact.length <= 8) {
    return '*'.repeat(compact.length);
  }

  const visibleTail = compact.slice(-4);
  const prefix = compact.slice(0, Math.min(7, compact.length - 4));
  return `${prefix}${'*'.repeat(Math.max(4, compact.length - prefix.length - 4))}${visibleTail}`;
}

export function hasSecretContext(content: string, index: number): boolean {
  const windowStart = Math.max(0, index - 80);
  const windowEnd = Math.min(content.length, index + 80);
  const window = content.slice(windowStart, windowEnd).toLowerCase();

  return /(?:api[_-]?key|secret|password|token|auth|credential|private|access[_-]?key)/.test(window);
}

export function hasPiiContext(content: string, index: number): boolean {
  const windowStart = Math.max(0, index - 60);
  const windowEnd = Math.min(content.length, index + 60);
  const window = content.slice(windowStart, windowEnd).toLowerCase();

  return /(?:customer|müşteri|user|patient|email|phone|ssn|tckn|iban|tax|identity|billing|kredi\s*kart|credit\s*card|\bcard\b)/i.test(
    window,
  );
}

export function confidenceFromSignals(params: {
  validated?: boolean;
  entropy?: number;
  contextual?: boolean;
  branded?: boolean;
}): Confidence {
  let score = 0;
  if (params.validated) score += 2;
  if (params.branded) score += 2;
  if (params.contextual) score += 1;
  if (params.entropy !== undefined && params.entropy >= 4.3) score += 1;

  if (score >= 4) return 'HIGH';
  if (score >= 2) return 'MEDIUM';
  return 'LOW';
}

export function severityFor(category: 'secret' | 'pii', confidence: Confidence): Severity {
  if (category === 'secret') {
    if (confidence === 'HIGH') return 'critical';
    if (confidence === 'MEDIUM') return 'high';
    return 'medium';
  }

  if (confidence === 'HIGH') return 'high';
  if (confidence === 'MEDIUM') return 'medium';
  return 'low';
}

export function globToRegExp(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '§§')
    .replace(/\*/g, '[^/]*')
    .replace(/§§/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${escaped}$`, 'i');
}

export function pathMatchesAny(filename: string, patterns: string[]): boolean {
  return patterns.some((pattern) => globToRegExp(pattern).test(filename.replace(/\\/g, '/')));
}

export function rangesOverlap(a: [number, number], b: [number, number]): boolean {
  return a[0] < b[1] && b[0] < a[1];
}
