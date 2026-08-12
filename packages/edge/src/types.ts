export interface CustomRule {
  pattern: RegExp | string;
  replacement: string;
  label?: string;
}

export interface NexusShieldOptions {
  maskTCKN?: boolean;
  maskCreditCard?: boolean;
  maskEmail?: boolean;
  maskPhone?: boolean;
  maskAPIKey?: boolean;
  customRules?: CustomRule[];
}

export interface ShieldResult {
  sanitizedInput: string;
  piiDetected: boolean;
  maskedTypes: string[];
  latencyMs: number;
}

export interface NexusShield {
  sanitize(input: string): ShieldResult;
}
