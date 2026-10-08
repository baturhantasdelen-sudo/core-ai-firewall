import type { AssuranceRuleGroup, ExpectedSideEffects } from '@/lib/nexus-core/assurance/types';

export interface A2BScenario {
  id: string;
  vertical: 'finance' | 'erp' | 'crm';
  name: string;
  action: string;
  fixture_id: string;
  rules: AssuranceRuleGroup;
  expected_side_effects?: ExpectedSideEffects;
  tool_response?: { status_code: number; body: string };
  expect_status: 'VERIFIED' | 'UNVERIFIED' | 'FAILED';
  expect_false_success?: boolean;
}

const finRules = (fields: Record<string, unknown>): AssuranceRuleGroup => ({
  logic: 'ALL',
  rules: Object.entries(fields).map(([field, value]) => ({
    field,
    operator: 'EQUALS' as const,
    value,
  })),
});

export const A2B_SCENARIOS: A2BScenario[] = [
  // Finance (8)
  {
    id: 'A2B-F01',
    vertical: 'finance',
    name: 'Payment settled exact',
    action: 'create_payment',
    fixture_id: 'payment_ok',
    rules: finRules({ payment_status: 'SETTLED', amount: 50000, currency: 'USD' }),
    expect_status: 'VERIFIED',
  },
  {
    id: 'A2B-F02',
    vertical: 'finance',
    name: 'Amount mismatch critical',
    action: 'create_payment',
    fixture_id: 'payment_amount_mismatch',
    rules: finRules({ amount: 50000 }),
    expect_status: 'FAILED',
  },
  {
    id: 'A2B-F03',
    vertical: 'finance',
    name: 'False success pending payment',
    action: 'create_payment',
    fixture_id: 'payment_false_success',
    rules: finRules({ payment_status: 'SETTLED', ledger_entry: true }),
    tool_response: { status_code: 200, body: '{"success":true}' },
    expect_status: 'UNVERIFIED',
    expect_false_success: true,
  },
  {
    id: 'A2B-F04',
    vertical: 'finance',
    name: 'Refund posted',
    action: 'create_refund',
    fixture_id: 'refund_ok',
    rules: finRules({ payment_status: 'REFUNDED', amount: 1200 }),
    expect_status: 'VERIFIED',
  },
  {
    id: 'A2B-F05',
    vertical: 'finance',
    name: 'Transfer funds ledger',
    action: 'transfer_funds',
    fixture_id: 'transfer_ok',
    rules: finRules({ payment_status: 'TRANSFERRED', ledger_entry: true }),
    expect_status: 'VERIFIED',
  },
  {
    id: 'A2B-F06',
    vertical: 'finance',
    name: 'Customer id binding',
    action: 'create_payment',
    fixture_id: 'payment_ok',
    rules: finRules({ customer_id: 'cust-100' }),
    expect_status: 'VERIFIED',
  },
  {
    id: 'A2B-F07',
    vertical: 'finance',
    name: 'Invoice target on payment',
    action: 'create_payment',
    fixture_id: 'payment_ok',
    rules: finRules({ invoice_id: 'inv-8842' }),
    expect_status: 'VERIFIED',
  },
  {
    id: 'A2B-F08',
    vertical: 'finance',
    name: 'Currency constraint',
    action: 'create_payment',
    fixture_id: 'payment_ok',
    rules: { logic: 'ALL', rules: [{ field: 'currency', operator: 'IN', value: ['USD', 'EUR'] }] },
    expect_status: 'VERIFIED',
  },
  // ERP (7)
  {
    id: 'A2B-E01',
    vertical: 'erp',
    name: 'Invoice closed zero balance',
    action: 'close_invoice',
    fixture_id: 'invoice_closed',
    rules: finRules({ 'invoice.status': 'CLOSED', invoice_balance: 0 }),
    expect_status: 'VERIFIED',
  },
  {
    id: 'A2B-E02',
    vertical: 'erp',
    name: 'Invoice still open',
    action: 'close_invoice',
    fixture_id: 'invoice_open',
    rules: finRules({ 'invoice.status': 'CLOSED' }),
    expect_status: 'UNVERIFIED',
  },
  {
    id: 'A2B-E03',
    vertical: 'erp',
    name: 'Balance reconciliation mismatch',
    action: 'reconcile_balance',
    fixture_id: 'balance_mismatch',
    rules: finRules({ invoice_balance: 0 }),
    expect_status: 'FAILED',
  },
  {
    id: 'A2B-E04',
    vertical: 'erp',
    name: 'Unauthorized ERP field change',
    action: 'update_invoice',
    fixture_id: 'erp_tamper',
    rules: { logic: 'ALL', rules: [{ field: 'unauthorized_field_change', operator: 'EQUALS', value: false }] },
    expect_status: 'UNVERIFIED',
  },
  {
    id: 'A2B-E05',
    vertical: 'erp',
    name: 'Invoice paid flag',
    action: 'close_invoice',
    fixture_id: 'invoice_closed',
    rules: finRules({ invoice_paid: true }),
    expect_status: 'VERIFIED',
  },
  {
    id: 'A2B-E06',
    vertical: 'erp',
    name: 'Status EXISTS',
    action: 'update_invoice',
    fixture_id: 'invoice_closed',
    rules: { logic: 'ALL', rules: [{ field: 'invoice.status', operator: 'EXISTS' }] },
    expect_status: 'VERIFIED',
  },
  {
    id: 'A2B-E07',
    vertical: 'erp',
    name: 'NOT_EQUALS open when closed expected',
    action: 'close_invoice',
    fixture_id: 'invoice_closed',
    rules: { logic: 'ALL', rules: [{ field: 'invoice.status', operator: 'NOT_EQUALS', value: 'OPEN' }] },
    expect_status: 'VERIFIED',
  },
  // CRM (5)
  {
    id: 'A2B-C01',
    vertical: 'crm',
    name: 'Profile segment standard',
    action: 'update_profile',
    fixture_id: 'profile_ok',
    rules: finRules({ segment: 'STANDARD' }),
    expect_status: 'VERIFIED',
  },
  {
    id: 'A2B-C02',
    vertical: 'crm',
    name: 'VIP upgrade verified',
    action: 'change_segment',
    fixture_id: 'vip_upgrade',
    rules: finRules({ segment: 'VIP' }),
    expect_status: 'VERIFIED',
  },
  {
    id: 'A2B-C03',
    vertical: 'crm',
    name: 'Shadow field alteration',
    action: 'update_profile',
    fixture_id: 'shadow_alteration',
    rules: { logic: 'ALL', rules: [{ field: 'shadow_field', operator: 'EQUALS', value: false }] },
    expected_side_effects: {
      allowed_fields: ['customer_id', 'segment', 'shadow_field'],
      expected_mutations: { segment: 'VIP' },
      forbidden_fields: ['shadow_field'],
    },
    expect_status: 'UNVERIFIED',
  },
  {
    id: 'A2B-C04',
    vertical: 'crm',
    name: 'Bulk mutation detection',
    action: 'bulk_sync',
    fixture_id: 'bulk_mutation',
    rules: finRules({ segment: 'STANDARD' }),
    expected_side_effects: {
      allowed_fields: ['customer_id', 'segment'],
      expected_mutations: { segment: 'STANDARD' },
    },
    expect_status: 'FAILED',
  },
  {
    id: 'A2B-C05',
    vertical: 'crm',
    name: 'Customer id EXISTS',
    action: 'update_profile',
    fixture_id: 'profile_ok',
    rules: { logic: 'ALL', rules: [{ field: 'customer_id', operator: 'EXISTS' }] },
    expect_status: 'VERIFIED',
  },
];

export function a2bScenarioCounts(): { finance: number; erp: number; crm: number; total: number } {
  const finance = A2B_SCENARIOS.filter((s) => s.vertical === 'finance').length;
  const erp = A2B_SCENARIOS.filter((s) => s.vertical === 'erp').length;
  const crm = A2B_SCENARIOS.filter((s) => s.vertical === 'crm').length;
  return { finance, erp, crm, total: A2B_SCENARIOS.length };
}
