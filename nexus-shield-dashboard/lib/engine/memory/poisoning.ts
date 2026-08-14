export type {
  MemorySource,
  MemoryInput,
  MemoryGuardResult,
  MemoryQuarantineEntry,
  MemoryRollbackResult,
} from './memory-guard';

export {
  scanAndProtectMemory,
  rollbackMemoryToLastTrustedState,
  getMemoryIntegrityScore,
  listMemoryQuarantineEntries,
  resetMemoryGuardState,
} from './memory-guard';

import {
  scanAndProtectMemory,
  resetMemoryGuardState,
  type MemoryInput,
  type MemoryGuardResult,
} from './memory-guard';

/** @deprecated Use MemoryInput from memory-guard */
export interface AgentMemoryScanInput {
  agentId: string;
  content: string;
  source: MemoryInput['source'];
  metadata?: Record<string, unknown>;
}

/** @deprecated Use MemoryGuardResult from memory-guard */
export type MemoryPoisoningResult = MemoryGuardResult;

/** Backward-compatible wrapper for existing tests */
export function scanAgentMemory(input: AgentMemoryScanInput): MemoryGuardResult {
  return scanAndProtectMemory(input.agentId, {
    content: input.content,
    source: input.source,
    metadata: input.metadata,
  });
}

export function resetMemoryScanState(): void {
  resetMemoryGuardState();
}
