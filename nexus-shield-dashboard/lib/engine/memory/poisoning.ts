export interface AgentMemoryScanInput {
  agentId: string;
  content: string;
  source: 'vector_db' | 'conversation_buffer' | 'long_term_memory' | 'tool_output';
  metadata?: Record<string, unknown>;
}

export interface MemoryPoisoningResult {
  safe: boolean;
  blocked: boolean;
  riskScore: number;
  patterns: string[];
  violations: string[];
}

const POISONING_PATTERNS: Array<{ id: string; pattern: RegExp; weight: number }> = [
  { id: 'SYSTEM_OVERRIDE', pattern: /ignore (all )?(previous|prior|system) instructions/i, weight: 35 },
  { id: 'ROLE_HIJACK', pattern: /you are now (an? )?(admin|root|unrestricted|developer)/i, weight: 30 },
  { id: 'HIDDEN_HTML', pattern: /<!--[\s\S]*?(system|override|ignore)[\s\S]*?-->/i, weight: 28 },
  { id: 'PROMPT_LEAK', pattern: /repeat (your )?(system prompt|hidden instructions)/i, weight: 25 },
  { id: 'TOOL_INJECTION', pattern: /call tool .* without (approval|authorization)/i, weight: 22 },
  { id: 'MEMORY_OVERRIDE', pattern: /overwrite (agent )?memory with/i, weight: 30 },
  { id: 'EXFIL_MARKER', pattern: /send (all|every) (records|data|secrets) to/i, weight: 32 },
  { id: 'BASE64_PAYLOAD', pattern: /[A-Za-z0-9+/]{120,}={0,2}/, weight: 15 },
];

const TRUSTED_SOURCES = new Set<string>(['tool_output']);

export function scanAgentMemory(input: AgentMemoryScanInput): MemoryPoisoningResult {
  const patterns: string[] = [];
  const violations: string[] = [];
  let riskScore = 0;

  for (const rule of POISONING_PATTERNS) {
    if (rule.pattern.test(input.content)) {
      patterns.push(rule.id);
      violations.push(`MEMORY_POISONING: detected ${rule.id} pattern in ${input.source}`);
      riskScore += rule.weight;
    }
  }

  if (input.source === 'vector_db' && /<\/?script/i.test(input.content)) {
    patterns.push('HTML_SCRIPT_INJECTION');
    violations.push('MEMORY_POISONING: script markup detected in vector memory write');
    riskScore += 20;
  }

  if (
    input.metadata?.author === 'external_user' &&
    /always (trust|follow) this memory/i.test(input.content)
  ) {
    patterns.push('EXTERNAL_TRUST_ESCALATION');
    violations.push('MEMORY_POISONING: external memory attempts trust escalation');
    riskScore += 25;
  }

  if (TRUSTED_SOURCES.has(input.source)) {
    riskScore = Math.max(0, riskScore - 10);
  }

  riskScore = Math.min(100, riskScore);
  const blocked = riskScore >= 40;

  return {
    safe: violations.length === 0,
    blocked,
    riskScore,
    patterns,
    violations,
  };
}

export function resetMemoryScanState(): void {
  // Reserved for future persistent scan state; no-op for current in-memory implementation.
}
