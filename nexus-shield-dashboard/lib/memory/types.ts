/**
 * P2 Sprint 13-14 — Memory Security & Vector Provenance types.
 */

export type MemorySourceType = 'USER_PROMPT' | 'TOOL_OUTPUT' | 'EXTERNAL_API' | 'SYSTEM_PROMPT';

export type MemorySecurityStatus = 'TRUSTED' | 'UNTRUSTED' | 'POISONED_CANDIDATE';

export interface MemoryProvenance {
  step: number;
  source: MemorySourceType;
  timestamp: string;
  reference?: string;
  description: string;
}

export interface MemoryEntry {
  memoryId: string;
  agentId: string;
  vectorHash: string;
  source: MemorySourceType;
  trustScore: number;
  status: MemorySecurityStatus;
  provenanceChain: MemoryProvenance[];
  contentPreview: string;
  isolated: boolean;
  detectedPatterns: string[];
  createdAt: string;
}

export interface MemorySecurityInput {
  agentId: string;
  content: string;
  source: MemorySourceType;
  provenanceChain?: MemoryProvenance[];
  metadata?: Record<string, unknown>;
}

export interface MemorySecurityEvaluation {
  entry: MemoryEntry;
  safe: boolean;
  poisonPatterns: string[];
  violations: string[];
  recommendation: 'ALLOW' | 'QUARANTINE' | 'BLOCK';
}

export interface MemoryIsolationResult {
  isolated: boolean;
  memoryId: string;
  previousStatus: MemorySecurityStatus;
  newStatus: MemorySecurityStatus;
  reason?: string;
}

export const POISONING_BLOCK_THRESHOLD = 40;
export const POISONING_QUARANTINE_THRESHOLD = 25;

export function isTrustedMemory(entry: MemoryEntry): boolean {
  return entry.status === 'TRUSTED' && !entry.isolated;
}

export function isPoisonedCandidate(entry: MemoryEntry): boolean {
  return entry.status === 'POISONED_CANDIDATE';
}
