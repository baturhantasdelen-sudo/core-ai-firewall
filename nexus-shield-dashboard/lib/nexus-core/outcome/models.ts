/** Outcome Verification domain — DO NOT TRUST THE AGENT. VERIFY THE WORLD. */

export type VerificationState =
  | 'EXPECTED'
  | 'ACTION_STARTED'
  | 'ACTION_EXECUTED'
  | 'VERIFYING'
  | 'VERIFIED'
  | 'FAILED'
  | 'UNVERIFIED'
  | 'BLOCKED';

export type VerificationResultStatus = 'VERIFIED' | 'UNVERIFIED' | 'FAILED' | 'BLOCKED';

export type DiffSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type ConstraintOperator =
  | 'EQUALS'
  | 'NOT_EQUALS'
  | 'GREATER_THAN'
  | 'LESS_THAN'
  | 'GREATER_OR_EQUAL'
  | 'LESS_OR_EQUAL'
  | 'IN'
  | 'NOT_IN'
  | 'CONTAINS'
  | 'MATCHES'
  | 'EXISTS'
  | 'NOT_EXISTS';

export interface ConstraintRule {
  field: string;
  operator: ConstraintOperator;
  value?: unknown;
}

export interface ConstraintGroup {
  logic: 'ALL' | 'ANY';
  rules: Array<ConstraintRule | ConstraintGroup>;
}

export interface ExpectedOutcome {
  outcome_id: string;
  action_id: string;
  type: string;
  expected_state: Record<string, unknown>;
  constraints?: ConstraintGroup;
  verification_deadline?: string;
  required_evidence?: string[];
}

export interface ActualOutcome {
  transaction_id: string;
  status: string;
  observed_state: Record<string, unknown>;
  timestamp: string;
  provider: string;
}

export interface VerificationPlan {
  sources: string[];
  required_sources: string[];
  timeout_ms: number;
  polling: {
    strategy: 'exponential' | 'fixed';
    intervals_ms: number[];
  };
}

export interface OutcomeDiff {
  field: string;
  expected: unknown;
  actual: unknown;
  difference: string;
  severity: DiffSeverity;
}

export interface Evidence {
  evidence_id: string;
  verification_id: string;
  source: string;
  source_type: string;
  resource: string;
  resource_id: string;
  observed_state_hash: string;
  observed_at: string;
  adapter: string;
  query_fingerprint: string;
  integrity_hash: string;
  previous_hash: string | null;
}

export interface VerificationIntegrity {
  hash_chain_valid: boolean;
  evidence_count: number;
  last_integrity_hash: string | null;
}

export interface VerificationResult {
  verification_id: string;
  verification_state: VerificationState;
  status: VerificationResultStatus;
  score: number;
  evidence: Evidence[];
  diff: OutcomeDiff[];
  integrity: VerificationIntegrity;
  divergence_reason?: string;
  false_success_detected: boolean;
  agent_claims_success: boolean;
  expected_outcome: ExpectedOutcome;
  actual_outcome?: ActualOutcome;
  completed_at: string;
}

export interface OutcomeVerifyRequest {
  agent_id: string;
  action_id: string;
  expected_outcome: ExpectedOutcome;
  verification_plan: VerificationPlan;
  adapter_id: 'mock' | 'generic_http' | 'database' | 'inline';
  tool_response?: { status_code: number; body: string };
  observed_state_override?: Record<string, unknown>;
  mock_fixture?: string;
  resource_id?: string;
  blocked_action?: boolean;
}
