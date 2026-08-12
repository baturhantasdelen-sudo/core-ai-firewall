import type { NexusShieldOptions } from "./types.js";

export const DEFAULT_PATTERNS = {
  TCKN: /\b[1-9]\d{10}\b/g,
  CREDIT_CARD: /\b(?:\d{4}[-\s]?){3}\d{4}\b|\b(?:\d[ -]*){13,19}\d\b/g,
  EMAIL: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  PHONE: /(?:\+?90|0)?\s*[5]\d{2}\s*\d{3}\s*\d{2}\s*\d{2}/g,
  API_KEY:
    /\b(?:sk-[a-zA-Z0-9]{20,}|ghp_[a-zA-Z0-9]{36}|gho_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9_]{22,}|AKIA[0-9A-Z]{16}|xox[baprs]-[a-zA-Z0-9-]{10,})\b/g,
} as const;

export type PatternKey = keyof typeof DEFAULT_PATTERNS;

export const OPTION_TO_PATTERN: Record<
  keyof Pick<
    NexusShieldOptions,
    "maskTCKN" | "maskCreditCard" | "maskEmail" | "maskPhone" | "maskAPIKey"
  >,
  PatternKey
> = {
  maskTCKN: "TCKN",
  maskCreditCard: "CREDIT_CARD",
  maskEmail: "EMAIL",
  maskPhone: "PHONE",
  maskAPIKey: "API_KEY",
};
