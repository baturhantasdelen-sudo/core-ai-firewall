import { createHash } from 'node:crypto';
import {
  POISONING_BLOCK_THRESHOLD,
  POISONING_QUARANTINE_THRESHOLD,
  type MemoryEntry,
  type MemoryIsolationResult,
  type MemoryProvenance,
  type MemorySecurityEvaluation,
  type MemorySecurityInput,
  type MemorySecurityStatus,
  type MemorySourceType,
} from '@/lib/memory/types';

const memoryStore = new Map<string, MemoryEntry>();

const POISONING_PATTERNS: Array<{ id: string; pattern: RegExp; weight: number }> = [
  { id: 'SYSTEM_OVERRIDE', pattern: /ignore (all )?(previous|prior|system) instructions/i, weight: 35 },
  { id: 'PROMPT_LEAK', pattern: /repeat (your )?(system prompt|hidden instructions)/i, weight: 25 },
  {
    id: 'PERSISTENT_INSTRUCTION',
    pattern: /always (trust|follow|obey) (this|these) (memory|instruction|rule)/i,
    weight: 30,
  },
  { id: 'ROLE_HIJACK', pattern: /you are now (an? )?(admin|root|unrestricted|developer)/i, weight: 30 },
  { id: 'HIDDEN_HTML', pattern: /<!--[\s\S]*?(system|override|ignore)[\s\S]*?-->/i, weight: 28 },
  { id: 'TOOL_INJECTION', pattern: /call tool .* without (approval|authorization)/i, weight: 22 },
  { id: 'MEMORY_OVERRIDE', pattern: /overwrite (agent )?memory with/i, weight: 30 },
  { id: 'EXFIL_MARKER', pattern: /send (all|every) (records|data|secrets) to/i, weight: 32 },
  { id: 'VECTOR_POISON', pattern: /inject (into|to) vector (store|memory|db)/i, weight: 35 },
  { id: 'BASE64_PAYLOAD', pattern: /[A-Za-z0-9+/]{120,}={0,2}/, weight: 15 },
];

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function generateMemoryId(agentId: string, vectorHash: string): string {
  return `mem_${sha256(`${agentId}:${vectorHash}`).slice(0, 12)}`;
}

function resolveStatus(riskScore: number): MemorySecurityStatus {
  if (riskScore >= POISONING_BLOCK_THRESHOLD) return 'POISONED_CANDIDATE';
  if (riskScore >= POISONING_QUARANTINE_THRESHOLD) return 'UNTRUSTED';
  return 'TRUSTED';
}

function resolveRecommendation(riskScore: number): MemorySecurityEvaluation['recommendation'] {
  if (riskScore >= POISONING_BLOCK_THRESHOLD) return 'BLOCK';
  if (riskScore >= POISONING_QUARANTINE_THRESHOLD) return 'QUARANTINE';
  return 'ALLOW';
}

function detectPoisoningPatterns(
  content: string,
  source: MemorySourceType,
): { patterns: string[]; violations: string[]; riskScore: number } {
  const patterns: string[] = [];
  const violations: string[] = [];
  let riskScore = 0;

  for (const rule of POISONING_PATTERNS) {
    if (rule.pattern.test(content)) {
      patterns.push(rule.id);
      violations.push(`MEMORY_POISONING: ${rule.id} detected in ${source}`);
      riskScore += rule.weight;
    }
  }

  if (source === 'EXTERNAL_API' && /<\/?script/i.test(content)) {
    patterns.push('HTML_SCRIPT_INJECTION');
    violations.push('MEMORY_POISONING: script markup in external API vector write');
    riskScore += 20;
  }

  if (source === 'EXTERNAL_API') {
    riskScore += 8;
  }

  if (source === 'TOOL_OUTPUT') {
    riskScore = Math.max(0, riskScore - 10);
  }

  return { patterns, violations, riskScore: Math.min(100, riskScore) };
}

function buildDefaultProvenance(
  source: MemorySourceType,
  agentId: string,
): MemoryProvenance[] {
  const timestamp = new Date().toISOString();
  return [
    {
      step: 1,
      source,
      timestamp,
      reference: agentId,
      description: `Initial ingestion from ${source}`,
    },
  ];
}

/**
 * Scans memory destined for vector store read/write and evaluates poisoning risk.
 */
export function evaluateMemorySecurity(input: MemorySecurityInput): MemorySecurityEvaluation {
  let { patterns, violations, riskScore } = detectPoisoningPatterns(input.content, input.source);

  if (
    input.metadata?.author === 'external_user' &&
    /always (trust|follow) this memory/i.test(input.content)
  ) {
    patterns.push('EXTERNAL_TRUST_ESCALATION');
    violations.push('MEMORY_POISONING: external memory attempts trust escalation');
    riskScore = Math.min(100, riskScore + 25);
  }

  const vectorHash = sha256(input.content);
  const memoryId = generateMemoryId(input.agentId, vectorHash);
  const trustScore = Math.max(0, 100 - riskScore);
  const status = resolveStatus(riskScore);
  const provenanceChain = input.provenanceChain ?? buildDefaultProvenance(input.source, input.agentId);

  const entry: MemoryEntry = {
    memoryId,
    agentId: input.agentId,
    vectorHash,
    source: input.source,
    trustScore,
    status,
    provenanceChain,
    contentPreview: input.content.slice(0, 140),
    isolated: status !== 'TRUSTED',
    detectedPatterns: patterns,
    createdAt: new Date().toISOString(),
  };

  memoryStore.set(memoryId, entry);

  return {
    entry,
    safe: violations.length === 0,
    poisonPatterns: patterns,
    violations,
    recommendation: resolveRecommendation(riskScore),
  };
}

/**
 * Isolates suspicious memory — marks as UNTRUSTED and removes from active vector access.
 */
export function isolateMemoryEntry(
  memoryId: string,
  reason = 'Manual quarantine from security panel',
): MemoryIsolationResult {
  const entry = memoryStore.get(memoryId);
  if (!entry) {
    return {
      isolated: false,
      memoryId,
      previousStatus: 'TRUSTED',
      newStatus: 'TRUSTED',
      reason: 'Memory entry not found',
    };
  }

  const previousStatus = entry.status;
  entry.status = 'UNTRUSTED';
  entry.isolated = true;
  entry.trustScore = Math.min(entry.trustScore, 20);

  if (!entry.detectedPatterns.includes('MANUAL_QUARANTINE')) {
    entry.detectedPatterns.push('MANUAL_QUARANTINE');
  }

  entry.provenanceChain.push({
    step: entry.provenanceChain.length + 1,
    source: 'SYSTEM_PROMPT',
    timestamp: new Date().toISOString(),
    reference: memoryId,
    description: reason,
  });

  return {
    isolated: true,
    memoryId,
    previousStatus,
    newStatus: entry.status,
    reason,
  };
}

export function listMemoryEntries(agentId?: string): MemoryEntry[] {
  const entries = [...memoryStore.values()];
  if (agentId) return entries.filter((entry) => entry.agentId === agentId);
  return entries.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export function getMemoryEntry(memoryId: string): MemoryEntry | undefined {
  const entry = memoryStore.get(memoryId);
  return entry ? { ...entry } : undefined;
}

export function quarantineUntrustedMemory(agentId?: string): number {
  let count = 0;
  for (const entry of memoryStore.values()) {
    if (agentId && entry.agentId !== agentId) continue;
    if (entry.status === 'UNTRUSTED' || entry.status === 'POISONED_CANDIDATE') {
      if (!entry.isolated) {
        isolateMemoryEntry(entry.memoryId, 'Bulk quarantine — untrusted memory isolation');
        count += 1;
      }
    }
  }
  return count;
}

export function resetMemorySecurityStore(): void {
  memoryStore.clear();
}
