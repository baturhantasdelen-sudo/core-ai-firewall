import type { Detector } from '@/lib/engine/types';
import { collectRegexMatches, detectHighEntropyInContent } from '@/lib/engine/detectors/helpers';
import { hasSecretContext } from '@/lib/engine/utils';

export const awsDetector: Detector = {
  id: 'aws-access-key',
  category: 'secret',
  profiles: [],
  detect(content, ctx) {
    return collectRegexMatches({
      content,
      ctx,
      ruleId: 'aws-access-key',
      type: 'AWS Access Key',
      category: 'secret',
      branded: true,
      regex: /\b(AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16})\b/g,
      contextCheck: hasSecretContext,
    });
  },
};

export const gcpDetector: Detector = {
  id: 'gcp-api-key',
  category: 'secret',
  profiles: [],
  detect(content, ctx) {
    return collectRegexMatches({
      content,
      ctx,
      ruleId: 'gcp-api-key',
      type: 'GCP API Key',
      category: 'secret',
      branded: true,
      regex: /\bAIza[0-9A-Za-z\-_]{35}\b/g,
      contextCheck: hasSecretContext,
    });
  },
};

export const openaiDetector: Detector = {
  id: 'openai-api-key',
  category: 'secret',
  profiles: [],
  detect(content, ctx) {
    return collectRegexMatches({
      content,
      ctx,
      ruleId: 'openai-api-key',
      type: 'OpenAI API Key',
      category: 'secret',
      branded: true,
      regex: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g,
      contextCheck: hasSecretContext,
    });
  },
};

export const stripeDetector: Detector = {
  id: 'stripe-secret-key',
  category: 'secret',
  profiles: [],
  detect(content, ctx) {
    return collectRegexMatches({
      content,
      ctx,
      ruleId: 'stripe-secret-key',
      type: 'Stripe Secret Key',
      category: 'secret',
      branded: true,
      regex: /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}\b/g,
      contextCheck: hasSecretContext,
    });
  },
};

export const githubDetector: Detector = {
  id: 'github-token',
  category: 'secret',
  profiles: [],
  detect(content, ctx) {
    return collectRegexMatches({
      content,
      ctx,
      ruleId: 'github-token',
      type: 'GitHub Token',
      category: 'secret',
      branded: true,
      regex: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{20,}\b/g,
      contextCheck: hasSecretContext,
    });
  },
};

export const npmDetector: Detector = {
  id: 'npm-token',
  category: 'secret',
  profiles: [],
  detect(content, ctx) {
    return collectRegexMatches({
      content,
      ctx,
      ruleId: 'npm-token',
      type: 'npm Access Token',
      category: 'secret',
      branded: true,
      regex: /\bnpm_[A-Za-z0-9]{36}\b/g,
      contextCheck: hasSecretContext,
    });
  },
};

export const pypiDetector: Detector = {
  id: 'pypi-token',
  category: 'secret',
  profiles: [],
  detect(content, ctx) {
    return collectRegexMatches({
      content,
      ctx,
      ruleId: 'pypi-token',
      type: 'PyPI API Token',
      category: 'secret',
      branded: true,
      regex: /\bpypi-AgEIcHlwaS5vcmc[A-Za-z0-9\-_]{50,}\b/g,
      contextCheck: hasSecretContext,
    });
  },
};

export const genericSecretDetector: Detector = {
  id: 'generic-secret',
  category: 'secret',
  profiles: [],
  detect(content, ctx) {
    const branded = collectRegexMatches({
      content,
      ctx,
      ruleId: 'generic-secret',
      type: 'Generic Secret',
      category: 'secret',
      regex: /\b(?:api[_-]?key|secret|password|token|auth[_-]?token)\s*[:=]\s*['"]?[A-Za-z0-9_\-./+=]{8,}['"]?/gi,
      contextCheck: hasSecretContext,
    });

    const entropyMatches = detectHighEntropyInContent(content, ctx, branded.map((m) => m.range));
    return [...branded, ...entropyMatches];
  },
};

export const secretDetectors: Detector[] = [
  awsDetector,
  gcpDetector,
  openaiDetector,
  stripeDetector,
  githubDetector,
  npmDetector,
  pypiDetector,
  genericSecretDetector,
];
