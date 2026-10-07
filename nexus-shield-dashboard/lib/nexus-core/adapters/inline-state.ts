import { createHash } from 'node:crypto';
import type { ExternalStateResult, OutcomeAdapterContext, OutcomeStateAdapter } from '@/lib/nexus-core/adapters/types';

function hashState(state: Record<string, unknown>): string {
  const hex = createHash('sha256').update(JSON.stringify(state)).digest('hex');
  return `sha256:${hex}`;
}

export const inlineStateAdapter: OutcomeStateAdapter = {
  system: 'INLINE_STATE',
  readCurrentState(ctx: OutcomeAdapterContext): ExternalStateResult {
    const state = ctx.inlineState ?? {};
    return {
      system: 'INLINE_STATE',
      entity_id: ctx.entityIdHint ?? ctx.toolArgs.invoice_id?.toString() ?? ctx.toolArgs.customer_id?.toString() ?? 'entity_unknown',
      current_state: state,
      timestamp: new Date().toISOString(),
      raw_hash: hashState(state),
    };
  },
};
