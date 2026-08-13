const PROMPT_INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?(previous|prior)\s+(instructions|directions|prompts|rules)/i,
  /disregard\s+(all\s+)?(previous|prior)\s+(instructions|directions|prompts|rules)/i,
  /forget\s+(all\s+)?(previous|prior)\s+(instructions|directions|prompts|rules)/i,
  /(output|show|print|reveal|display)\s+(the\s+)?(system\s+prompt|developer\s+mode|initial\s+instructions)/i,
  /what\s+(are|were)\s+your\s+(original|initial|system)\s+(instructions|prompts)/i,
  /you\s+are\s+now\s+(in\s+)?(DAN|developer|unrestricted|god)\s+mode/i,
  /act\s+as\s+an?\s+unfiltered/i,
  /bypass\s+(all\s+)?(safety|content|ethical)\s+(filters|policies|guardrails)/i,
  /\[system\]\s*:/i,
  /<\|im_start\|>/i,
  /###\s*Instruction/i,
  /system_prompt\s*:/i,
  /ignore\s+prior\s+instructions/i,
];

export const PROMPT_INJECTION_BLOCK_DETAIL =
  'Blocked by Nexus Shield Early Exit Engine (Prompt Injection Detected)';

export function quickSecurityScan(userInput: string): boolean {
  return PROMPT_INJECTION_PATTERNS.some((pattern) => pattern.test(userInput));
}
