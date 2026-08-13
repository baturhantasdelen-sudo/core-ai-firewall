import type { Profile, RuleAction } from '@/lib/engine/types';
import { z } from 'zod';

export interface NexusShieldPolicy {
  version: 1;
  profile: Profile;
  ignore_paths: string[];
  allowlist: {
    exact_matches: string[];
    regex_patterns: string[];
  };
  rules: {
    secret_detection: RuleAction;
    pii_detection: RuleAction;
  };
}

export const DEFAULT_POLICY: NexusShieldPolicy = {
  version: 1,
  profile: 'GLOBAL',
  ignore_paths: ['node_modules/**', 'tests/**', '**/__tests__/**', '**/fixtures/**'],
  allowlist: {
    exact_matches: [],
    regex_patterns: [],
  },
  rules: {
    secret_detection: 'block',
    pii_detection: 'warn',
  },
};

const policySchema = z.object({
  version: z.literal(1).default(1),
  profile: z.enum(['TR', 'GLOBAL', 'US']).default('GLOBAL'),
  ignore_paths: z.array(z.string()).default(DEFAULT_POLICY.ignore_paths),
  allowlist: z
    .object({
      exact_matches: z.array(z.string()).default([]),
      regex_patterns: z.array(z.string()).default([]),
    })
    .default(DEFAULT_POLICY.allowlist),
  rules: z
    .object({
      secret_detection: z.enum(['block', 'warn', 'off']).default('block'),
      pii_detection: z.enum(['block', 'warn', 'off']).default('warn'),
    })
    .default(DEFAULT_POLICY.rules),
});

function parseSimpleYaml(raw: string): unknown {
  const lines = raw.split('\n');
  const root: Record<string, unknown> = {};
  let currentKey: string | null = null;
  let currentList: string[] | null = null;
  let currentNested: Record<string, unknown> | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    if (trimmed.startsWith('- ')) {
      if (currentList) currentList.push(trimmed.slice(2).trim().replace(/^['"]|['"]$/g, ''));
      continue;
    }

    const listMatch = /^(\w+):\s*$/.exec(trimmed);
    if (listMatch) {
      currentKey = listMatch[1];
      currentList = [];
      root[currentKey] = currentList;
      currentNested = null;
      continue;
    }

    const nestedMatch = /^(\w+):\s*$/.exec(trimmed);
    const kvMatch = /^([\w_]+):\s*(.+)$/.exec(trimmed);
    if (kvMatch) {
      const [, key, value] = kvMatch;
      const parsedValue = value.replace(/^['"]|['"]$/g, '');

      if (key === 'exact_matches' || key === 'regex_patterns') {
        if (!currentNested && currentKey === 'allowlist') {
          currentNested = (root.allowlist as Record<string, unknown>) ?? {};
          root.allowlist = currentNested;
        }
        if (currentNested) {
          currentNested[key] = [parsedValue];
          currentList = currentNested[key] as string[];
        }
        continue;
      }

      if (key === 'secret_detection' || key === 'pii_detection') {
        if (!currentNested && currentKey === 'rules') {
          currentNested = (root.rules as Record<string, unknown>) ?? {};
          root.rules = currentNested;
        }
        if (currentNested) currentNested[key] = parsedValue;
        continue;
      }

      root[key] = parsedValue;
      currentKey = key;
      currentList = null;
      currentNested = null;
    }
  }

  return root;
}

export function parsePolicy(raw: string | Record<string, unknown>): NexusShieldPolicy {
  const parsedInput =
    typeof raw === 'string'
      ? (() => {
          const trimmed = raw.trim();
          if (trimmed.startsWith('{')) return JSON.parse(trimmed) as Record<string, unknown>;
          return parseSimpleYaml(trimmed) as Record<string, unknown>;
        })()
      : raw;

  const validated = policySchema.parse(parsedInput);
  return validated;
}

export function loadPolicyFromObject(input?: Record<string, unknown> | null): NexusShieldPolicy {
  if (!input) return DEFAULT_POLICY;
  return parsePolicy(input);
}
