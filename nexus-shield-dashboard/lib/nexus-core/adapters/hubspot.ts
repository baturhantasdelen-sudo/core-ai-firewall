import { createHash } from 'node:crypto';
import type { ExternalStateResult, OutcomeAdapterContext, OutcomeStateAdapter } from '@/lib/nexus-core/adapters/types';

function hashState(state: Record<string, unknown>): string {
  return `sha256:${createHash('sha256').update(JSON.stringify(state)).digest('hex')}`;
}

/** Mock HubSpot deal / contact state. */
export const hubspotOutcomeAdapter: OutcomeStateAdapter = {
  system: 'HUBSPOT',
  readCurrentState(ctx: OutcomeAdapterContext): ExternalStateResult {
    const dealId = String(ctx.toolArgs.deal_id ?? ctx.toolArgs.contact_id ?? 'deal_mock');
    const inline = ctx.inlineState ?? {};
    const current_state = {
      deal_id: dealId,
      dealstage: inline.dealstage ?? inline.stage ?? 'appointmentscheduled',
      amount: inline.amount ?? ctx.toolArgs.amount ?? 0,
      purchase_order_created: inline.purchase_order_created ?? false,
      ...inline,
    };
    return {
      system: 'HUBSPOT',
      entity_id: dealId,
      current_state,
      timestamp: new Date().toISOString(),
      raw_hash: hashState(current_state),
    };
  },
};
