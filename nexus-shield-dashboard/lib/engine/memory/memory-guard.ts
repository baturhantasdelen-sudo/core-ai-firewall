export type MemorySource = 'vector_db' | 'conversation_buffer' | 'long_term_memory' | 'tool_output';

export interface MemoryInput {
  content: string;
  source: MemorySource;
  metadata?: Record<string, unknown>;
}

export interface MemoryGuardResult {
  safe: boolean;
  blocked: boolean;
  quarantined: boolean;
  riskScore: number;
  integrityScore: number;
  patterns: string[];
  violations: string[];
}

export interface MemoryQuarantineEntry {
  id: string;
  agentId: string;
  source: MemorySource;
  status: 'CLEAN' | 'BLOCKED' | 'FLAGGED' | 'QUARANTINED';
  patterns: string[];
  contentPreview: string;
  timestamp: string;
}

export interface MemoryRollbackResult {
  agentId: string;
  rolledBack: boolean;
  restoredSnapshotId?: string;
  message: string;
}

interface TrustedMemorySnapshot {
  id: string;
  agentId: string;
  entries: MemoryInput[];
  capturedAt: string;
}

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
  { id: 'BASE64_PAYLOAD', pattern: /[A-Za-z0-9+/]{120,}={0,2}/, weight: 15 },
];

const trustedSnapshots = new Map<string, TrustedMemorySnapshot[]>();
const quarantineStore = new Map<string, MemoryQuarantineEntry[]>();
const agentMemoryStore = new Map<string, MemoryInput[]>();

const BLOCK_THRESHOLD = 40;
const QUARANTINE_THRESHOLD = 25;

function detectPoisoningPatterns(content: string, source: MemorySource): {
  patterns: string[];
  violations: string[];
  riskScore: number;
} {
  const patterns: string[] = [];
  const violations: string[] = [];
  let riskScore = 0;

  for (const rule of POISONING_PATTERNS) {
    if (rule.pattern.test(content)) {
      patterns.push(rule.id);
      violations.push(`MEMORY_POISONING: detected ${rule.id} pattern in ${source}`);
      riskScore += rule.weight;
    }
  }

  if (source === 'vector_db' && /<\/?script/i.test(content)) {
    patterns.push('HTML_SCRIPT_INJECTION');
    violations.push('MEMORY_POISONING: script markup detected in vector memory write');
    riskScore += 20;
  }

  return { patterns, violations, riskScore: Math.min(100, riskScore) };
}

function captureTrustedSnapshot(agentId: string, entry: MemoryInput): void {
  const snapshots = trustedSnapshots.get(agentId) ?? [];
  const latest = snapshots[snapshots.length - 1];
  const currentEntries = agentMemoryStore.get(agentId) ?? [];

  if (!latest || latest.entries.length !== currentEntries.length) {
    snapshots.push({
      id: `snap-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      agentId,
      entries: [...currentEntries],
      capturedAt: new Date().toISOString(),
    });
    if (snapshots.length > 10) snapshots.shift();
    trustedSnapshots.set(agentId, snapshots);
  }

  const memory = agentMemoryStore.get(agentId) ?? [];
  memory.push(entry);
  agentMemoryStore.set(agentId, memory);
}

function addQuarantineEntry(
  agentId: string,
  input: MemoryInput,
  result: MemoryGuardResult,
): MemoryQuarantineEntry {
  const status: MemoryQuarantineEntry['status'] = result.blocked
    ? 'BLOCKED'
    : result.quarantined
      ? 'QUARANTINED'
      : result.patterns.length > 0
        ? 'FLAGGED'
        : 'CLEAN';

  const entry: MemoryQuarantineEntry = {
    id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    agentId,
    source: input.source,
    status,
    patterns: result.patterns,
    contentPreview: input.content.slice(0, 120),
    timestamp: new Date().toISOString(),
  };

  const existing = quarantineStore.get(agentId) ?? [];
  existing.unshift(entry);
  if (existing.length > 50) existing.pop();
  quarantineStore.set(agentId, existing);

  return entry;
}

export function scanAndProtectMemory(
  agentId: string,
  memoryInput: MemoryInput,
): MemoryGuardResult {
  let { patterns, violations, riskScore } = detectPoisoningPatterns(
    memoryInput.content,
    memoryInput.source,
  );

  if (
    memoryInput.metadata?.author === 'external_user' &&
    /always (trust|follow) this memory/i.test(memoryInput.content)
  ) {
    patterns.push('EXTERNAL_TRUST_ESCALATION');
    violations.push('MEMORY_POISONING: external memory attempts trust escalation');
    riskScore = Math.min(100, riskScore + 25);
  }

  if (memoryInput.source === 'tool_output') {
    riskScore = Math.max(0, riskScore - 10);
  }

  const blocked = riskScore >= BLOCK_THRESHOLD;
  const quarantined = !blocked && riskScore >= QUARANTINE_THRESHOLD;
  const integrityScore = Math.max(0, 100 - riskScore);

  const result: MemoryGuardResult = {
    safe: violations.length === 0,
    blocked,
    quarantined,
    riskScore,
    integrityScore,
    patterns,
    violations,
  };

  if (blocked) {
    addQuarantineEntry(agentId, memoryInput, result);
  } else if (quarantined) {
    addQuarantineEntry(agentId, memoryInput, result);
  } else {
    captureTrustedSnapshot(agentId, memoryInput);
    if (patterns.length > 0) {
      addQuarantineEntry(agentId, memoryInput, result);
    }
  }

  return result;
}

export function rollbackMemoryToLastTrustedState(agentId: string): MemoryRollbackResult {
  const snapshots = trustedSnapshots.get(agentId) ?? [];
  const latest = snapshots[snapshots.length - 1];

  if (!latest) {
    return {
      agentId,
      rolledBack: false,
      message: 'No trusted memory snapshot available for rollback',
    };
  }

  agentMemoryStore.set(agentId, [...latest.entries]);

  const quarantined = quarantineStore.get(agentId) ?? [];
  for (const entry of quarantined) {
    if (entry.status === 'BLOCKED' || entry.status === 'QUARANTINED') {
      entry.status = 'FLAGGED';
    }
  }

  return {
    agentId,
    rolledBack: true,
    restoredSnapshotId: latest.id,
    message: `Memory rolled back to trusted snapshot ${latest.id} (${latest.entries.length} entries)`,
  };
}

export function getMemoryIntegrityScore(agentId: string): number {
  const entries = quarantineStore.get(agentId) ?? [];
  if (entries.length === 0) return 100;

  const recent = entries.slice(0, 10);
  const blocked = recent.filter((entry) => entry.status === 'BLOCKED').length;
  const flagged = recent.filter((entry) => entry.status === 'FLAGGED' || entry.status === 'QUARANTINED').length;

  return Math.max(0, 100 - blocked * 25 - flagged * 10);
}

export function listMemoryQuarantineEntries(agentId?: string): MemoryQuarantineEntry[] {
  if (agentId) return [...(quarantineStore.get(agentId) ?? [])];
  return [...quarantineStore.values()].flat();
}

export function resetMemoryGuardState(agentId?: string): void {
  if (agentId) {
    trustedSnapshots.delete(agentId);
    quarantineStore.delete(agentId);
    agentMemoryStore.delete(agentId);
    return;
  }
  trustedSnapshots.clear();
  quarantineStore.clear();
  agentMemoryStore.clear();
}
