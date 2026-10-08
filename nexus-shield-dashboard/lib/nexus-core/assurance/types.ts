export type AssuranceOperator =
  | 'EQUALS'
  | 'NOT_EQUALS'
  | 'GREATER'
  | 'LESS'
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

export type AssuranceLogic = 'ALL' | 'ANY';

export interface AssuranceRule {
  field: string;
  operator: AssuranceOperator;
  value?: unknown;
  authoritative_vertical?: string;
}

export interface AssuranceRuleGroup {
  logic: AssuranceLogic;
  rules: Array<AssuranceRule | AssuranceRuleGroup>;
}

export type AssuranceSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface AssuranceClaimDiff {
  field: string;
  expected: unknown;
  actual: unknown;
  difference: string;
  severity: AssuranceSeverity;
  authoritative_vertical: string;
}

export interface ExpectedSideEffects {
  allowed_fields: string[];
  expected_mutations: Record<string, unknown>;
  forbidden_fields?: string[];
}

export interface ActualSideEffects {
  observed_state: Record<string, unknown>;
  mutation_count?: number;
  bulk_update_detected?: boolean;
}

export interface AssuranceEvaluationResult {
  passed: boolean;
  score: number;
  claim_diffs: AssuranceClaimDiff[];
  side_effect_violations: AssuranceClaimDiff[];
}
