import { evaluateOperator } from '@/lib/nexus-core/outcome/engine';
import type { OutcomeVerifyRequest } from '@/lib/nexus-core/outcome/models';
import { defaultVerificationPlan } from '@/lib/nexus-core/outcome/verifier';

export interface OutcomeBenchmarkScenario {
  id: string;
  name: string;
  request: OutcomeVerifyRequest;
  expect_status: 'VERIFIED' | 'UNVERIFIED' | 'FAILED' | 'BLOCKED';
  expect_false_success?: boolean;
  expect_critical_diff?: boolean;
}

function baseExpected(action_id: string, state: Record<string, unknown>) {
  return {
    outcome_id: `out_${action_id}`,
    action_id,
    type: 'ledger_posting',
    expected_state: state,
  };
}

export const OUTCOME_BENCHMARK_SCENARIOS: OutcomeBenchmarkScenario[] = [
  {
    id: 'test_1',
    name: 'Exact match',
    request: {
      agent_id: 'agent-1',
      action_id: 'act-1',
      expected_outcome: baseExpected('act-1', { status: 'POSTED', amount: 50000, ledger_entry: true }),
      verification_plan: defaultVerificationPlan(),
      adapter_id: 'mock',
      mock_fixture: 'exact_match',
    },
    expect_status: 'VERIFIED',
  },
  {
    id: 'test_2',
    name: 'Amount mismatch 50k vs 500',
    request: {
      agent_id: 'agent-1',
      action_id: 'act-2',
      expected_outcome: baseExpected('act-2', { status: 'POSTED', amount: 50000, ledger_entry: true }),
      verification_plan: defaultVerificationPlan(),
      adapter_id: 'mock',
      mock_fixture: 'amount_mismatch',
    },
    expect_status: 'FAILED',
    expect_critical_diff: true,
  },
  {
    id: 'test_3',
    name: 'False success HTTP 200 without ledger',
    request: {
      agent_id: 'agent-1',
      action_id: 'act-3',
      expected_outcome: baseExpected('act-3', { status: 'POSTED', amount: 50000, ledger_entry: true }),
      verification_plan: defaultVerificationPlan(),
      adapter_id: 'mock',
      mock_fixture: 'pending_false_success',
      tool_response: { status_code: 200, body: '{"success":true}' },
    },
    expect_status: 'UNVERIFIED',
    expect_false_success: true,
  },
  {
    id: 'test_4',
    name: 'Ghost action — success claim, unchanged world',
    request: {
      agent_id: 'agent-1',
      action_id: 'act-4',
      expected_outcome: baseExpected('act-4', { status: 'POSTED', ledger_entry: true }),
      verification_plan: defaultVerificationPlan(),
      adapter_id: 'mock',
      mock_fixture: 'ghost',
      tool_response: { status_code: 200, body: 'ok completed' },
    },
    expect_status: 'UNVERIFIED',
    expect_false_success: true,
  },
  {
    id: 'test_5',
    name: 'Side effect detection',
    request: {
      agent_id: 'agent-1',
      action_id: 'act-5',
      expected_outcome: {
        ...baseExpected('act-5', { status: 'POSTED', amount: 50000, ledger_entry: true }),
        constraints: {
          logic: 'ALL',
          rules: [{ field: 'extra_debit', operator: 'NOT_EXISTS' }],
        },
      },
      verification_plan: defaultVerificationPlan(),
      adapter_id: 'mock',
      mock_fixture: 'side_effect',
    },
    expect_status: 'UNVERIFIED',
  },
  {
    id: 'test_6',
    name: 'SLA / pending violation',
    request: {
      agent_id: 'agent-1',
      action_id: 'act-6',
      expected_outcome: baseExpected('act-6', { status: 'POSTED', ledger_entry: true }),
      verification_plan: defaultVerificationPlan(),
      adapter_id: 'mock',
      mock_fixture: 'sla_pending',
    },
    expect_status: 'UNVERIFIED',
  },
  {
    id: 'test_7',
    name: 'Temporal stale observation',
    request: {
      agent_id: 'agent-1',
      action_id: 'act-7',
      expected_outcome: baseExpected('act-7', { status: 'POSTED', amount: 50000 }),
      verification_plan: defaultVerificationPlan(),
      adapter_id: 'mock',
      mock_fixture: 'temporal_stale',
    },
    expect_status: 'VERIFIED',
  },
  {
    id: 'test_8',
    name: 'Post-block verification',
    request: {
      agent_id: 'agent-1',
      action_id: 'act-8',
      expected_outcome: baseExpected('act-8', { status: 'POSTED', ledger_entry: true }),
      verification_plan: defaultVerificationPlan(),
      adapter_id: 'mock',
      blocked_action: true,
    },
    expect_status: 'BLOCKED',
  },
  {
    id: 'test_9',
    name: 'Operator NOT_EQUALS pass',
    request: {
      agent_id: 'agent-1',
      action_id: 'act-9',
      expected_outcome: {
        ...baseExpected('act-9', {}),
        constraints: { logic: 'ALL', rules: [{ field: 'status', operator: 'NOT_EQUALS', value: 'PENDING' }] },
      },
      verification_plan: defaultVerificationPlan(),
      adapter_id: 'mock',
      mock_fixture: 'exact_match',
    },
    expect_status: 'VERIFIED',
  },
  {
    id: 'test_10',
    name: 'Operator EXISTS',
    request: {
      agent_id: 'agent-1',
      action_id: 'act-10',
      expected_outcome: {
        ...baseExpected('act-10', {}),
        constraints: { logic: 'ALL', rules: [{ field: 'ledger_entry', operator: 'EXISTS' }] },
      },
      verification_plan: defaultVerificationPlan(),
      adapter_id: 'mock',
      mock_fixture: 'exact_match',
    },
    expect_status: 'VERIFIED',
  },
  {
    id: 'test_11',
    name: 'ANY grouping — one rule passes',
    request: {
      agent_id: 'agent-1',
      action_id: 'act-11',
      expected_outcome: {
        ...baseExpected('act-11', {}),
        constraints: {
          logic: 'ANY',
          rules: [
            { field: 'status', operator: 'EQUALS', value: 'FAILED' },
            { field: 'status', operator: 'EQUALS', value: 'POSTED' },
          ],
        },
      },
      verification_plan: defaultVerificationPlan(),
      adapter_id: 'mock',
      mock_fixture: 'exact_match',
    },
    expect_status: 'VERIFIED',
  },
  {
    id: 'test_12',
    name: 'Database adapter read-only + fingerprint',
    request: {
      agent_id: 'agent-1',
      action_id: 'act-12',
      expected_outcome: baseExpected('act-12', { status: 'POSTED', ledger_entry: true }),
      verification_plan: defaultVerificationPlan(),
      adapter_id: 'database',
      observed_state_override: { status: 'POSTED', ledger_entry: true },
      resource_id: 'txn-db-12',
    },
    expect_status: 'VERIFIED',
  },
];

/** Smoke all comparison operators (used in DoD + unit checks). */
export function allOperatorsSmokeTest(): boolean {
  return (
    evaluateOperator('EQUALS', 1, 1) &&
    evaluateOperator('GREATER_THAN', 5, 3) &&
    evaluateOperator('IN', 'a', ['a', 'b']) &&
    evaluateOperator('MATCHES', 'abc-123', '^abc') &&
    evaluateOperator('EXISTS', 'x') &&
    evaluateOperator('NOT_EXISTS', undefined)
  );
}
