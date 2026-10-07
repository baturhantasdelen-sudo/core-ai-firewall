import { createHash } from 'node:crypto';
import type { ExternalStateResult, OutcomeAdapterContext, OutcomeStateAdapter } from '@/lib/nexus-core/adapters/types';

function hashState(state: Record<string, unknown>): string {
  return `sha256:${createHash('sha256').update(JSON.stringify(state)).digest('hex')}`;
}

/** Mock Salesforce CRM record state. */
export const salesforceOutcomeAdapter: OutcomeStateAdapter = {
  system: 'SALESFORCE',
  readCurrentState(ctx: OutcomeAdapterContext): ExternalStateResult {
    const recordId = String(ctx.toolArgs.record_id ?? ctx.toolArgs.account_id ?? '001MOCK');
    const inline = ctx.inlineState ?? {};
    const current_state = {
      object: 'Account',
      record_id: recordId,
      is_deleted: inline.is_deleted ?? inline.deleted ?? false,
      stage: inline.stage ?? 'Open',
      ...inline,
    };
    return {
      system: 'SALESFORCE',
      entity_id: recordId,
      current_state,
      timestamp: new Date().toISOString(),
      raw_hash: hashState(current_state),
    };
  },
};
