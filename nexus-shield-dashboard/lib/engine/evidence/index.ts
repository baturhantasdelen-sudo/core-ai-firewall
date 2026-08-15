export type {
  EvidenceStatus,
  EvidenceType,
  CriticalActionType,
  ActionPayload,
  EvidenceData,
  EvidenceChainResult,
  EvidenceChainLogEntry,
} from './evidence-chain';

export {
  verifyActionEvidence as verifyEvidenceChain,
  recordEvidenceChainLog,
  listEvidenceChainLogs,
  getEvidenceVerificationRatio,
  resetEvidenceChainStore,
} from './evidence-chain';

export {
  verifyActionOutcome,
  recordOutcomeVerification,
  listOutcomeVerificationLogs,
  resetEvidentialVerifierStore,
} from './evidential-verifier';
export type {
  VerificationStatus,
  ProofComponent,
  ActionOutcomePayload,
  EvidenceBundle,
  OutcomeVerificationResult,
} from './evidential-verifier';

import {
  verifyActionEvidence as verifyChain,
  type ActionPayload,
  type CriticalActionType,
  type EvidenceData,
  type EvidenceChainResult,
} from './evidence-chain';

/** Legacy alias used across action-firewall */
export type ActionEvidence = EvidenceData;

export interface EvidenceVerificationInput {
  actionType: CriticalActionType;
  toolName: string;
  evidence?: EvidenceData;
}

export type EvidenceVerificationResult = EvidenceChainResult;

/** Supports (actionPayload, evidenceData) and legacy single-object input */
export function verifyActionEvidence(
  inputOrPayload: EvidenceVerificationInput | ActionPayload,
  evidenceData?: EvidenceData,
): EvidenceChainResult {
  if (arguments.length >= 2) {
    return verifyChain(inputOrPayload as ActionPayload, evidenceData);
  }

  const legacy = inputOrPayload as EvidenceVerificationInput;
  return verifyChain(
    { toolName: legacy.toolName, actionType: legacy.actionType },
    legacy.evidence,
  );
}
