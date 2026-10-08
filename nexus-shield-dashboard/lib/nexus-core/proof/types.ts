import type { Uar20Receipt } from '@/lib/nexus-core/uar/models';

export interface ProofClaimEvidence {
  claim: string;
  field: string;
  authoritative_vertical: string;
  source_id: string;
  observed_at: string;
  query_fingerprint: string;
  observed_state_hash: string;
  expected: unknown;
  actual: unknown;
  match: boolean;
}

export interface ProofIntegrityChecks {
  signature_valid: boolean;
  chain_valid: boolean;
  authority_valid: boolean;
  hash_chain_valid: boolean;
}

export interface TransactionProofBundle {
  transaction_id: string;
  verification_status: string;
  false_success_detected: boolean;
  claims: ProofClaimEvidence[];
  integrity: ProofIntegrityChecks;
  uar20: Uar20Receipt;
  exported_at: string;
}

export interface ProofManifest {
  manifest_version: '1.0';
  transaction_id: string;
  proof_file: string;
  public_key_id: string;
  exported_at: string;
  schema: string;
}
