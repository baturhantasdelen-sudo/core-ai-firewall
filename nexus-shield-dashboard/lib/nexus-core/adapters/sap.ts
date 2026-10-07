import { createHash } from 'node:crypto';
import type { ExternalStateResult, OutcomeAdapterContext, OutcomeStateAdapter } from '@/lib/nexus-core/adapters/types';

function hashState(state: Record<string, unknown>): string {
  return `sha256:${createHash('sha256').update(JSON.stringify(state)).digest('hex')}`;
}

/** Mock SAP ERP ledger read — replace with RFC/OData connector in production. */
export const sapOutcomeAdapter: OutcomeStateAdapter = {
  system: 'SAP',
  readCurrentState(ctx: OutcomeAdapterContext): ExternalStateResult {
    const invoiceId = String(ctx.toolArgs.invoice_id ?? ctx.entityIdHint ?? 'INV-UNKNOWN');
    const inline = ctx.inlineState ?? {};
    const current_state = {
      module: 'FI-AR',
      invoice_id: invoiceId,
      payment_status: inline.payment_status ?? inline.refund_status ?? inline.invoice_paid ?? 'UNPAID',
      ledger_balance: inline.ledger_balance ?? 420000,
      last_posting_id: inline.last_posting_id ?? null,
      ...inline,
    };
    return {
      system: 'SAP',
      entity_id: invoiceId,
      current_state,
      timestamp: new Date().toISOString(),
      raw_hash: hashState(current_state),
    };
  },
};
