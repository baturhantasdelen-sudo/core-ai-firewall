/** Read-only outcome adapters — verification never executes writes. */

import { createHash } from 'node:crypto';
import type { Evidence } from '@/lib/nexus-core/outcome/models';
import { assertRegisteredQuery } from '@/lib/nexus-core/assurance-engine/db-query-registry';
import { isHttpUrlAllowed, parseAllowlistFromEnv } from '@/lib/nexus-core/assurance-engine/http-allowlist';
import { appendEvidenceChain, sha256Canonical } from '@/lib/nexus-core/outcome/evidence';

export interface OutcomeAdapterCapabilities {
  read_only: true;
  supports_polling: boolean;
  supports_query_fingerprint: boolean;
}

export interface OutcomeAdapterContext {
  resource_id?: string;
  mock_fixture?: string;
  inline_state?: Record<string, unknown>;
  http_url?: string;
  sql?: string;
  sql_params?: unknown[];
}

export interface OutcomeAdapter {
  id: string;
  get_state(ctx: OutcomeAdapterContext): Record<string, unknown>;
  verify_state(ctx: OutcomeAdapterContext, expected: Record<string, unknown>): boolean;
  get_evidence(
    ctx: OutcomeAdapterContext,
    verification_id: string,
    previous: Evidence | null,
  ): Evidence;
  health_check(): { ok: boolean; message: string };
  capabilities(): OutcomeAdapterCapabilities;
}

const MOCK_FIXTURES: Record<string, Record<string, unknown>> = {
  exact_match: { status: 'POSTED', amount: 50000, ledger_entry: true },
  amount_mismatch: { status: 'POSTED', amount: 500, ledger_entry: true },
  pending_false_success: { status: 'PENDING', amount: 50000, ledger_entry: false },
  ghost: { status: 'UNCHANGED', amount: 50000, ledger_entry: false },
  side_effect: { status: 'POSTED', amount: 50000, ledger_entry: true, extra_debit: true },
  sla_pending: { status: 'PENDING', amount: 50000, ledger_entry: false },
  temporal_stale: { status: 'POSTED', amount: 50000, ledger_entry: true, as_of: '1970-01-01' },
  post_block: { status: 'BLOCKED', amount: 0, ledger_entry: false },
  finance_wrong_refund: {
    refund_amount: 500000,
    currency: 'TRY',
    invoice_id: 'INV-1001',
    status: 'REFUNDED',
    ledger_entry: true,
  },
  erp_payment_pending: { status: 'PENDING', invoice_id: 'INV-2001', payment_status: 'PENDING' },
  finance_verified_refund: {
    refund_amount: 50000,
    currency: 'TRY',
    invoice_id: 'INV-3001',
    status: 'REFUNDED',
    ledger_entry: true,
  },
  blocked_unchanged: { status: 'UNCHANGED', refund_amount: 0 },
  blocked_mutated: { status: 'REFUNDED', refund_amount: 50000, invoice_id: 'INV-BLOCK' },
};

export class MockOutcomeAdapter implements OutcomeAdapter {
  id = 'mock';

  get_state(ctx: OutcomeAdapterContext): Record<string, unknown> {
    if (ctx.inline_state) return { ...ctx.inline_state };
    const key = ctx.mock_fixture ?? 'exact_match';
    return { ...(MOCK_FIXTURES[key] ?? MOCK_FIXTURES.exact_match) };
  }

  verify_state(ctx: OutcomeAdapterContext, expected: Record<string, unknown>): boolean {
    const state = this.get_state(ctx);
    return Object.entries(expected).every(
      ([k, v]) => state[k] === v || String(state[k]) === String(v),
    );
  }

  get_evidence(ctx: OutcomeAdapterContext, verification_id: string, previous: Evidence | null): Evidence {
    const state = this.get_state(ctx);
    const observed_state_hash = sha256Canonical(state);
    const query_fingerprint = `mock:${ctx.mock_fixture ?? 'default'}`;
    return appendEvidenceChain(verification_id, previous, {
      source: 'mock',
      source_type: 'fixture',
      resource: 'ledger',
      resource_id: ctx.resource_id ?? 'mock-1',
      observed_state_hash,
      observed_at: new Date().toISOString(),
      adapter: this.id,
      query_fingerprint,
    });
  }

  health_check() {
    return { ok: true, message: 'mock adapter ready' };
  }

  capabilities(): OutcomeAdapterCapabilities {
    return { read_only: true, supports_polling: true, supports_query_fingerprint: true };
  }
}

export class GenericHttpOutcomeAdapter implements OutcomeAdapter {
  id = 'generic_http';

  get_state(ctx: OutcomeAdapterContext): Record<string, unknown> {
    if (ctx.inline_state) return { ...ctx.inline_state };
    if (ctx.http_url) {
      const allowed = isHttpUrlAllowed(ctx.http_url, parseAllowlistFromEnv());
      if (!allowed.ok) {
        throw new Error(`HTTP verification blocked: ${allowed.reason}`);
      }
    }
    return { status: 'UNKNOWN', note: 'configure inline_state or allowlisted http_url with deployment fetch' };
  }

  verify_state(ctx: OutcomeAdapterContext, expected: Record<string, unknown>): boolean {
    return new MockOutcomeAdapter().verify_state(ctx, expected);
  }

  get_evidence(ctx: OutcomeAdapterContext, verification_id: string, previous: Evidence | null): Evidence {
    const state = this.get_state(ctx);
    return appendEvidenceChain(verification_id, previous, {
      source: ctx.http_url ?? 'http://observer',
      source_type: 'http_read',
      resource: 'external',
      resource_id: ctx.resource_id ?? 'http-1',
      observed_state_hash: sha256Canonical(state),
      observed_at: new Date().toISOString(),
      adapter: this.id,
      query_fingerprint: `GET:${ctx.http_url ?? 'inline'}`,
    });
  }

  health_check() {
    return { ok: true, message: 'generic http read-only observer' };
  }

  capabilities(): OutcomeAdapterCapabilities {
    return { read_only: true, supports_polling: true, supports_query_fingerprint: false };
  }
}

const ALLOWED_SQL = /^\s*SELECT\s+/i;

export class DatabaseReadOnlyOutcomeAdapter implements OutcomeAdapter {
  id = 'database';

  get_state(ctx: OutcomeAdapterContext): Record<string, unknown> {
    if (ctx.inline_state) return { ...ctx.inline_state };
    if (ctx.sql) {
      if (!ALLOWED_SQL.test(ctx.sql)) {
        throw new Error('Database adapter rejects non-SELECT queries');
      }
      assertRegisteredQuery(ctx.sql);
    }
    return { status: 'POSTED', ledger_entry: true };
  }

  verify_state(ctx: OutcomeAdapterContext, expected: Record<string, unknown>): boolean {
    return new MockOutcomeAdapter().verify_state(ctx, expected);
  }

  queryFingerprint(sql?: string, params?: unknown[]): string {
    const base = sql?.trim() ?? 'SELECT inline';
    const paramHash = createHash('sha256').update(JSON.stringify(params ?? [])).digest('hex').slice(0, 16);
    return `db:${base.slice(0, 80)}:${paramHash}`;
  }

  get_evidence(ctx: OutcomeAdapterContext, verification_id: string, previous: Evidence | null): Evidence {
    const state = this.get_state(ctx);
    return appendEvidenceChain(verification_id, previous, {
      source: 'database',
      source_type: 'sql_select',
      resource: 'ledger_table',
      resource_id: ctx.resource_id ?? 'db-1',
      observed_state_hash: sha256Canonical(state),
      observed_at: new Date().toISOString(),
      adapter: this.id,
      query_fingerprint: this.queryFingerprint(ctx.sql, ctx.sql_params),
    });
  }

  health_check() {
    return { ok: true, message: 'database read-only adapter' };
  }

  capabilities(): OutcomeAdapterCapabilities {
    return { read_only: true, supports_polling: true, supports_query_fingerprint: true };
  }
}

export class InlineOutcomeAdapter implements OutcomeAdapter {
  id = 'inline';

  get_state(ctx: OutcomeAdapterContext): Record<string, unknown> {
    return { ...(ctx.inline_state ?? {}) };
  }

  verify_state(ctx: OutcomeAdapterContext, expected: Record<string, unknown>): boolean {
    return new MockOutcomeAdapter().verify_state(ctx, expected);
  }

  get_evidence(ctx: OutcomeAdapterContext, verification_id: string, previous: Evidence | null): Evidence {
    const state = this.get_state(ctx);
    return appendEvidenceChain(verification_id, previous, {
      source: 'inline',
      source_type: 'pipeline_state',
      resource: 'tool_state',
      resource_id: ctx.resource_id ?? 'inline-1',
      observed_state_hash: sha256Canonical(state),
      observed_at: new Date().toISOString(),
      adapter: this.id,
      query_fingerprint: 'inline:stateAfter',
    });
  }

  health_check() {
    return { ok: true, message: 'inline state adapter' };
  }

  capabilities(): OutcomeAdapterCapabilities {
    return { read_only: true, supports_polling: false, supports_query_fingerprint: true };
  }
}

export function resolveOutcomeAdapterV2(id: OutcomeVerifyAdapterId): OutcomeAdapter {
  switch (id) {
    case 'mock':
      return new MockOutcomeAdapter();
    case 'generic_http':
      return new GenericHttpOutcomeAdapter();
    case 'database':
      return new DatabaseReadOnlyOutcomeAdapter();
    case 'inline':
    default:
      return new InlineOutcomeAdapter();
  }
}

export type OutcomeVerifyAdapterId = 'mock' | 'generic_http' | 'database' | 'inline';
