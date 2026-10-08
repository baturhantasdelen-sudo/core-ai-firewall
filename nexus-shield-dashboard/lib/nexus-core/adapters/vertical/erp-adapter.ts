import type { ErpAction, VerticalAdapter, VerticalAdapterContext, VerticalReadResult } from '@/lib/nexus-core/adapters/vertical/types';

const FIXTURES: Record<string, Record<string, unknown>> = {
  invoice_closed: {
    'invoice.status': 'CLOSED',
    invoice_balance: 0,
    invoice_paid: true,
    unauthorized_field_change: false,
  },
  invoice_open: {
    'invoice.status': 'OPEN',
    invoice_balance: 50000,
    invoice_paid: false,
  },
  balance_mismatch: {
    'invoice.status': 'CLOSED',
    invoice_balance: 1200,
    invoice_paid: true,
  },
  erp_tamper: {
    'invoice.status': 'CLOSED',
    invoice_balance: 0,
    invoice_paid: true,
    unauthorized_field_change: true,
  },
};

export class ErpVerticalAdapter implements VerticalAdapter {
  vertical = 'erp' as const;
  supported_actions: ErpAction[] = ['close_invoice', 'update_invoice', 'reconcile_balance'];

  read_state(ctx: VerticalAdapterContext): VerticalReadResult {
    const state = ctx.inline_state ?? FIXTURES[ctx.fixture_id ?? 'invoice_closed'] ?? FIXTURES.invoice_closed!;
    return {
      vertical: 'erp',
      action: ctx.action,
      observed_state: { ...state },
      observed_at: new Date().toISOString(),
      source_id: ctx.transaction_id ?? 'erp-1',
      query_fingerprint: `erp:${ctx.action}:${ctx.fixture_id ?? 'default'}`,
    };
  }

  health_check() {
    return { ok: true, message: 'erp vertical adapter (read-only)' };
  }
}
