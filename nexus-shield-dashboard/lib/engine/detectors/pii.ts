import type { Detector } from '@/lib/engine/types';
import { collectRegexMatches } from '@/lib/engine/detectors/helpers';
import { hasPiiContext, isValidTckn, luhnCheck } from '@/lib/engine/utils';

export const trPiiDetectors: Detector[] = [
  {
    id: 'tckn',
    category: 'pii',
    profiles: ['TR'],
    detect(content, ctx) {
      return collectRegexMatches({
        content,
        ctx,
        ruleId: 'tckn',
        type: 'TCKN',
        category: 'pii',
        regex: /\b(?<![\d.])([1-9]\d{10})(?![\d.])\b/g,
        validate: isValidTckn,
        contextCheck: hasPiiContext,
      });
    },
  },
  {
    id: 'tr-iban',
    category: 'pii',
    profiles: ['TR'],
    detect(content, ctx) {
      return collectRegexMatches({
        content,
        ctx,
        ruleId: 'tr-iban',
        type: 'TR IBAN',
        category: 'pii',
        regex: /\bTR\d{2}(?:\s?\d{4}){5}\s?\d{2}\b/gi,
        validate: (value) => value.replace(/\s+/g, '').length === 26,
        contextCheck: hasPiiContext,
      });
    },
  },
  {
    id: 'vkn',
    category: 'pii',
    profiles: ['TR'],
    detect(content, ctx) {
      return collectRegexMatches({
        content,
        ctx,
        ruleId: 'vkn',
        type: 'VKN',
        category: 'pii',
        regex: /\b\d{10}\b/g,
        validate: (value) => /^\d{10}$/.test(value),
        contextCheck: hasPiiContext,
      });
    },
  },
  {
    id: 'tr-phone',
    category: 'pii',
    profiles: ['TR'],
    detect(content, ctx) {
      return collectRegexMatches({
        content,
        ctx,
        ruleId: 'tr-phone',
        type: 'TR Phone',
        category: 'pii',
        regex: /\b(?:\+90|0)?5\d{2}[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}\b/g,
        contextCheck: hasPiiContext,
      });
    },
  },
];

export const globalPiiDetectors: Detector[] = [
  {
    id: 'ssn',
    category: 'pii',
    profiles: ['US', 'GLOBAL'],
    detect(content, ctx) {
      return collectRegexMatches({
        content,
        ctx,
        ruleId: 'ssn',
        type: 'SSN',
        category: 'pii',
        regex: /\b(?!000|666|9\d{2})\d{3}-(?!00)\d{2}-(?!0000)\d{4}\b/g,
        contextCheck: hasPiiContext,
      });
    },
  },
  {
    id: 'credit-card',
    category: 'pii',
    profiles: ['US', 'GLOBAL'],
    detect(content, ctx) {
      return collectRegexMatches({
        content,
        ctx,
        ruleId: 'credit-card',
        type: 'Credit Card',
        category: 'pii',
        regex:
          /\b(?:(?:4\d{3}|5[1-5]\d{2}|3[47]\d{2}|6(?:011|5\d{2}))[\s-]?){3}(?:\d{4}|\d{3}[\s-]?\d{4})\b/g,
        validate: luhnCheck,
        contextCheck: hasPiiContext,
      });
    },
  },
  {
    id: 'email',
    category: 'pii',
    profiles: ['US', 'GLOBAL'],
    detect(content, ctx) {
      return collectRegexMatches({
        content,
        ctx,
        ruleId: 'email',
        type: 'Email',
        category: 'pii',
        regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
        contextCheck: hasPiiContext,
      });
    },
  },
  {
    id: 'global-iban',
    category: 'pii',
    profiles: ['US', 'GLOBAL'],
    detect(content, ctx) {
      return collectRegexMatches({
        content,
        ctx,
        ruleId: 'global-iban',
        type: 'IBAN',
        category: 'pii',
        regex: /\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]){11,30}\b/g,
        validate: (value) => {
          const compact = value.replace(/\s+/g, '');
          return compact.length >= 15 && compact.length <= 34;
        },
        contextCheck: hasPiiContext,
      });
    },
  },
];
