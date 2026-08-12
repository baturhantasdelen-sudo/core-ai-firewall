import { DEFAULT_PATTERNS, OPTION_TO_PATTERN } from "./patterns.js";
import type {
  CustomRule,
  NexusShield,
  NexusShieldOptions,
  ShieldResult,
} from "./types.js";

const DEFAULT_OPTIONS: Required<
  Omit<NexusShieldOptions, "customRules">
> = {
  maskTCKN: true,
  maskCreditCard: true,
  maskEmail: true,
  maskPhone: true,
  maskAPIKey: true,
};

function compileRule(rule: CustomRule): RegExp {
  return typeof rule.pattern === "string" ? new RegExp(rule.pattern, "g") : rule.pattern;
}

function applyPattern(
  text: string,
  pattern: RegExp,
  label: string,
  maskedTypes: string[],
): string {
  if (!pattern.test(text)) {
    return text;
  }

  maskedTypes.push(label);
  return text.replace(pattern, `[${label}_REDACTED]`);
}

function sanitizeText(
  input: string,
  options: Required<Omit<NexusShieldOptions, "customRules">>,
  customRules: CustomRule[],
): ShieldResult {
  const start = performance.now();
  let sanitizedInput = input;
  const maskedTypes: string[] = [];

  for (const [optionKey, patternKey] of Object.entries(OPTION_TO_PATTERN) as Array<
    [keyof typeof OPTION_TO_PATTERN, keyof typeof DEFAULT_PATTERNS]
  >) {
    if (!options[optionKey]) {
      continue;
    }

    const pattern = DEFAULT_PATTERNS[patternKey];
    pattern.lastIndex = 0;
    sanitizedInput = applyPattern(sanitizedInput, pattern, patternKey, maskedTypes);
  }

  for (const rule of customRules) {
    const pattern = compileRule(rule);
    const label = rule.label ?? "CUSTOM";
    sanitizedInput = applyPattern(sanitizedInput, pattern, label, maskedTypes);
  }

  return {
    sanitizedInput,
    piiDetected: maskedTypes.length > 0,
    maskedTypes,
    latencyMs: performance.now() - start,
  };
}

export function createNexusShield(options: NexusShieldOptions = {}): NexusShield {
  const resolvedOptions: Required<Omit<NexusShieldOptions, "customRules">> = {
    ...DEFAULT_OPTIONS,
    ...options,
  };
  const customRules = options.customRules ?? [];

  return {
    sanitize(input: string): ShieldResult {
      return sanitizeText(input, resolvedOptions, customRules);
    },
  };
}

export function sanitizeTextWithOptions(
  input: string,
  options: NexusShieldOptions = {},
): ShieldResult {
  return createNexusShield(options).sanitize(input);
}
