import { createHash } from 'node:crypto';
import type { ExternalStateResult, OutcomeAdapterContext, OutcomeStateAdapter } from '@/lib/nexus-core/adapters/types';

function hashState(state: Record<string, unknown>): string {
  return `sha256:${createHash('sha256').update(JSON.stringify(state)).digest('hex')}`;
}

/** Mock SQL state verification — production: parameterized SELECT hook. */
export const databaseOutcomeAdapter: OutcomeStateAdapter = {
  system: 'DATABASE',
  readCurrentState(ctx: OutcomeAdapterContext): ExternalStateResult {
    const table = String(ctx.toolArgs.table ?? 'records');
    const inline = ctx.inlineState ?? {};
    const current_state = {
      query: `SELECT * FROM ${table} WHERE id = $1`,
      row_count: inline.row_count ?? 1,
      row_hash: inline.row_hash ?? inline.database_record_hash ?? null,
      modified: inline.modified ?? inline.updated_at ?? null,
      ...inline,
    };
    return {
      system: 'DATABASE',
      entity_id: `${table}:${ctx.toolArgs.id ?? 'primary'}`,
      current_state,
      timestamp: new Date().toISOString(),
      raw_hash: hashState(current_state),
    };
  },
};
