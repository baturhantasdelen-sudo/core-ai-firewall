import type { FindingCategory } from './types';

export const MASK_TOKENS: Record<string, string> = {
  tckn: 'MASKED_TCKN',
  'tr-iban': 'MASKED_IBAN',
  'global-iban': 'MASKED_IBAN',
  vkn: 'MASKED_VKN',
  'credit-card': 'MASKED_CARD',
  email: 'MASKED_EMAIL',
  'tr-phone': 'MASKED_PHONE',
  ssn: 'MASKED_SSN',
  'openai-api-key': 'MASKED_SECRET',
  'stripe-secret-key': 'MASKED_SECRET',
  'github-token': 'MASKED_SECRET',
  'aws-access-key': 'MASKED_SECRET',
  'gcp-api-key': 'MASKED_SECRET',
  'npm-token': 'MASKED_SECRET',
  'pypi-token': 'MASKED_SECRET',
  'generic-secret': 'MASKED_SECRET',
  'high-entropy-secret': 'MASKED_SECRET',
};

export function maskTokenForRule(ruleId: string, type: string): string {
  const token = MASK_TOKENS[ruleId];
  if (token) return `[${token}]`;
  const normalized = type.toUpperCase().replace(/\s+/g, '_');
  return `[MASKED_${normalized}]`;
}

export function hoverMessage(type: string, category: FindingCategory): string {
  const emoji = category === 'pii' ? '🛡️' : '🔐';
  return `${emoji} Nexus Shield: ${type} Detected! Masking recommended before push.`;
}
