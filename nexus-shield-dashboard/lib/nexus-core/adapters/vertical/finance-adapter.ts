import type { FinanceAction, VerticalAdapter, VerticalAdapterContext, VerticalReadResult } from '@/lib/nexus-core/adapters/vertical/types';

const FIXTURES: Record<string, Record<string, unknown>> = {
  payment_ok: {
    payment_status: 'SETTLED',
    amount: 50000,
    currency: 'USD',
    customer_id: 'cust-100',
    invoice_id: 'inv-8842',
    ledger_entry: true,
  },
  payment_amount_mismatch: {
    payment_status: 'SETTLED',
    amount: 500,
    currency: 'USD',
    customer_id: 'cust-100',
    invoice_id: 'inv-8842',
    ledger_entry: true,
  },
  payment_false_success: {
    payment_status: 'PENDING',
    amount: 50000,
    currency: 'USD',
    customer_id: 'cust-100',
    ledger_entry: false,
  },
  refund_ok: { payment_status: 'REFUNDED', amount: 1200, currency: 'USD', ledger_entry: true },
  transfer_ok: { payment_status: 'TRANSFERRED', amount: 10000, currency: 'USD', ledger_entry: true },
};

export class FinanceVerticalAdapter implements VerticalAdapter {
  vertical = 'finance' as const;
  supported_actions: FinanceAction[] = ['create_payment', 'create_refund', 'transfer_funds'];

  read_state(ctx: VerticalAdapterContext): VerticalReadResult {
    const state = ctx.inline_state ?? FIXTURES[ctx.fixture_id ?? 'payment_ok'] ?? FIXTURES.payment_ok!;
    return {
      vertical: 'finance',
      action: ctx.action,
      observed_state: { ...state },
      observed_at: new Date().toISOString(),
      source_id: ctx.transaction_id ?? 'fin-1',
      query_fingerprint: `finance:${ctx.action}:${ctx.fixture_id ?? 'default'}`,
    };
  }

  health_check() {
    return { ok: true, message: 'finance vertical adapter (read-only)' };
  }
}
