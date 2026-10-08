import type { OutcomeVerifyRequest } from '@/lib/nexus-core/outcome/models';
import { defaultVerificationPlan } from '@/lib/nexus-core/outcome/verifier';

/** Deterministic demo flows — executed via real verifier, not frontend fiction. */

export function demoFinanceWrongAmount(): OutcomeVerifyRequest {
  return {
    agent_id: 'finance-agent-07',
    action_id: 'act-inv-1001-refund',
    expected_outcome: {
      outcome_id: 'out_inv_1001',
      action_id: 'act-inv-1001-refund',
      type: 'refund',
      expected_state: { refund_amount: 50000, currency: 'TRY', invoice_id: 'INV-1001', status: 'REFUNDED' },
    },
    verification_plan: defaultVerificationPlan(),
    adapter_id: 'mock',
    mock_fixture: 'finance_wrong_refund',
    tool_response: { status_code: 200, body: '{"success":true}' },
    resource_id: 'INV-1001',
  };
}

export function demoErpPendingFalseSuccess(): OutcomeVerifyRequest {
  return {
    agent_id: 'finance-agent-07',
    action_id: 'act-inv-2001-pay',
    expected_outcome: {
      outcome_id: 'out_inv_2001',
      action_id: 'act-inv-2001-pay',
      type: 'payment',
      expected_state: { status: 'PAID', invoice_id: 'INV-2001' },
    },
    verification_plan: defaultVerificationPlan(),
    adapter_id: 'mock',
    mock_fixture: 'erp_payment_pending',
    tool_response: { status_code: 200, body: 'success completed' },
    resource_id: 'INV-2001',
  };
}

export function demoFinanceVerified(): OutcomeVerifyRequest {
  return {
    agent_id: 'finance-agent-07',
    action_id: 'act-inv-3001-refund',
    expected_outcome: {
      outcome_id: 'out_inv_3001',
      action_id: 'act-inv-3001-refund',
      type: 'refund',
      expected_state: {
        invoice_id: 'INV-3001',
        refund_amount: 50000,
        currency: 'TRY',
        status: 'REFUNDED',
      },
    },
    verification_plan: defaultVerificationPlan(),
    adapter_id: 'mock',
    mock_fixture: 'finance_verified_refund',
    resource_id: 'INV-3001',
  };
}

export function demoBlockedUnchanged(): OutcomeVerifyRequest {
  return {
    agent_id: 'finance-agent-07',
    action_id: 'act-block-1',
    expected_outcome: {
      outcome_id: 'out_block_1',
      action_id: 'act-block-1',
      type: 'refund',
      expected_state: { status: 'UNCHANGED' },
    },
    verification_plan: defaultVerificationPlan(),
    adapter_id: 'mock',
    blocked_action: true,
    mock_fixture: 'blocked_unchanged',
    state_before: { status: 'UNCHANGED', refund_amount: 0 },
  };
}

export function demoBlockedSideEffect(): OutcomeVerifyRequest {
  return {
    agent_id: 'finance-agent-07',
    action_id: 'act-block-2',
    expected_outcome: {
      outcome_id: 'out_block_2',
      action_id: 'act-block-2',
      type: 'refund',
      expected_state: { status: 'UNCHANGED' },
    },
    verification_plan: defaultVerificationPlan(),
    adapter_id: 'mock',
    blocked_action: true,
    mock_fixture: 'blocked_mutated',
    state_before: { status: 'UNCHANGED', refund_amount: 0 },
  };
}
