/** UAR 2.0 — vendor-neutral assurance receipt (action vs verification separated). */

export type Uar20VerificationStatus = 'VERIFIED' | 'UNVERIFIED' | 'FAILED' | 'BLOCKED' | 'NOT_RUN';

export interface Uar20Principal {
  agent_id: string;
  parent_agent_id?: string;
  delegation_chain: string[];
  passport_id?: string;
}

export interface Uar20Authority {
  effective_scopes: string[];
  authority_hash: string;
}

export interface Uar20Intent {
  user_intent: string;
  intent_hash: string;
}

export interface Uar20Policy {
  policy_hash: string;
  decision: string;
}

export interface Uar20Action {
  /** What happened? — execution occurrence */
  tool_name: string;
  tool_call_hash: string;
  transaction_id: string;
  executed: boolean;
  execution_timestamp: string;
}

export interface Uar20OutcomeSlice {
  expected_state: Record<string, unknown>;
  actual_state?: Record<string, unknown>;
}

export interface Uar20VerificationSlice {
  /** Was it verified? — independent world-state proof */
  status: Uar20VerificationStatus;
  score: number;
  multi_source: Array<{
    vertical: string;
    source_id: string;
    observed_at: string;
    query_fingerprint: string;
    observed_state_hash: string;
  }>;
  claim_diffs: Array<{
    field: string;
    expected: unknown;
    actual: unknown;
    severity: string;
    authoritative_vertical: string;
  }>;
  false_success_detected: boolean;
  verification_id?: string;
  evidence_ids: string[];
}

export interface Uar20Integrity {
  parameter_hash: string;
  outcome_hash: string;
  evidence_hash: string;
  receipt_body_hash: string;
  previous_uar_hash: string | null;
  hash_chain_valid: boolean;
}

export interface Uar20Signatures {
  algorithm: 'Ed25519-SHA256' | 'SHA256-HMAC-DEMO';
  signature: string;
  public_key_id: string;
}

export interface Uar20Receipt {
  $schema: 'https://nexusshield.ai/schemas/uar-2.0.json';
  uar_version: '2.0';
  receipt_id: string;
  timestamp: string;
  principal: Uar20Principal;
  authority: Uar20Authority;
  intent: Uar20Intent;
  policy: Uar20Policy;
  action: Uar20Action;
  expected_outcome: Uar20OutcomeSlice;
  actual_outcome?: Uar20OutcomeSlice;
  verification: Uar20VerificationSlice;
  integrity: Uar20Integrity;
  signatures: Uar20Signatures;
}
