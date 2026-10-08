import type { DiffSeverity, OutcomeDiff, VerificationResultStatus } from '@/lib/nexus-core/outcome/models';

export const ASSURANCE_VERIFIER_VERSION = '1.0.0';

export type DiffClassification =
  | 'TRANSACTION_AMOUNT_MISMATCH'
  | 'TRANSACTION_TARGET_MISMATCH'
  | 'TRANSACTION_STATUS_MISMATCH'
  | 'RESOURCE_ID_MISMATCH'
  | 'RESOURCE_COUNT_EXPLOSION'
  | 'SIDE_EFFECT_VIOLATION'
  | 'TEMPORAL_VIOLATION'
  | 'FIELD_MISMATCH'
  | 'POST_BLOCK_MUTATION';

export interface ClassifiedOutcomeDiff extends OutcomeDiff {
  operator?: string;
  classification: DiffClassification;
  critical: boolean;
  message: string;
}

export type SideEffectStatus = 'NONE' | 'EXPECTED_OK' | 'PROHIBITED_DETECTED' | 'UNKNOWN';

export type TransactionIntegrityStatus = 'OK' | 'MISMATCH' | 'PENDING' | 'MISSING';

export type TemporalStatus = 'OK' | 'DEADLINE_EXCEEDED' | 'NOT_EVALUATED';

export interface AssuranceEngineResult {
  verification_id: string;
  status: VerificationResultStatus;
  verification_reason?: string;
  false_success_detected: boolean;
  post_block_side_effect_detected: boolean;
  side_effect_status: SideEffectStatus;
  transaction_integrity: TransactionIntegrityStatus;
  temporal_status: TemporalStatus;
  authoritative_source: string;
  differences: ClassifiedOutcomeDiff[];
  evidence_ids: string[];
  verification_latency_ms: number;
  verifier_version: string;
  idempotency_key?: string;
  reused_existing?: boolean;
}
