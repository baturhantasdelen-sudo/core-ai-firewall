import type { VerificationState } from '@/lib/nexus-core/outcome/models';

const ALLOWED: Record<VerificationState, VerificationState[]> = {
  EXPECTED: ['ACTION_STARTED', 'BLOCKED'],
  ACTION_STARTED: ['ACTION_EXECUTED', 'BLOCKED', 'VERIFYING'],
  ACTION_EXECUTED: ['VERIFYING', 'FAILED', 'UNVERIFIED', 'VERIFIED'],
  VERIFYING: ['VERIFIED', 'FAILED', 'UNVERIFIED'],
  VERIFIED: [],
  FAILED: [],
  UNVERIFIED: [],
  BLOCKED: [],
};

/** Internal extension for post-block path (stored in verification_reason, not public status). */
export type InternalVerifyPhase = 'POST_BLOCK_VERIFYING';

export function assertTransition(from: VerificationState, to: VerificationState): void {
  if (!ALLOWED[from]?.includes(to)) {
    throw new Error(`Invalid verification transition ${from} → ${to}`);
  }
}

export function safeTransition(from: VerificationState, to: VerificationState): VerificationState {
  if (ALLOWED[from]?.includes(to)) return to;
  return from;
}
