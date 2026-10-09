/**
 * Read-only Finance/ERP HTTP observer — sandbox/test only when configured.
 *
 * Env:
 * - NEXUS_FINANCE_ERP_BASE_URL (HTTPS, allowlisted host)
 * - NEXUS_FINANCE_ERP_ENV=sandbox|test (required for live reads; production refused)
 * - NEXUS_FINANCE_ERP_LIVE_TEST=true to enable contract live test
 */

import type { OutcomeAdapterContext } from '@/lib/nexus-core/adapters/outcome-adapter-v2';
import { isHttpUrlAllowed, parseAllowlistFromEnv } from '@/lib/nexus-core/assurance-engine/http-allowlist';

export function financeErpResourceUrl(resourceId: string): string {
  const base = process.env.NEXUS_FINANCE_ERP_BASE_URL?.replace(/\/$/, '');
  if (!base) {
    throw new Error('NEXUS_FINANCE_ERP_BASE_URL not configured');
  }
  const env = process.env.NEXUS_FINANCE_ERP_ENV ?? 'sandbox';
  if (env === 'production') {
    throw new Error('Finance/ERP live observer refuses production environment');
  }
  const url = `${base}/invoices/${encodeURIComponent(resourceId)}`;
  const allowed = isHttpUrlAllowed(url, parseAllowlistFromEnv());
  if (!allowed.ok) {
    throw new Error(`Finance ERP URL blocked: ${allowed.reason}`);
  }
  return url;
}

export function normalizeFinanceErpInvoicePayload(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object') {
    return { status: 'UNKNOWN', raw: body };
  }
  const o = body as Record<string, unknown>;
  return {
    invoice_id: o.invoice_id ?? o.id,
    status: o.status ?? o.payment_status,
    refund_amount: o.refund_amount ?? o.amount,
    currency: o.currency,
    payment_status: o.payment_status,
    ledger_entry: o.ledger_entry ?? o.posted_to_ledger,
    source: 'finance_erp_http',
    environment: process.env.NEXUS_FINANCE_ERP_ENV ?? 'sandbox',
  };
}

export function financeErpInlineOrConfiguredState(ctx: OutcomeAdapterContext): Record<string, unknown> {
  if (ctx.inline_state) return { ...ctx.inline_state };
  if (!ctx.resource_id) {
    throw new Error('Finance ERP observer requires resource_id (invoice id)');
  }
  if (process.env.NEXUS_FINANCE_ERP_INLINE_FIXTURE) {
    return normalizeFinanceErpInvoicePayload(JSON.parse(process.env.NEXUS_FINANCE_ERP_INLINE_FIXTURE));
  }
  financeErpResourceUrl(ctx.resource_id);
  throw new Error(
    'Finance ERP live HTTP read requires async verification; configure inline_state or NEXUS_FINANCE_ERP_INLINE_FIXTURE for sync path',
  );
}

export function isFinanceErpLiveConfigured(): boolean {
  return (
    process.env.NEXUS_FINANCE_ERP_LIVE_TEST === 'true' &&
    Boolean(process.env.NEXUS_FINANCE_ERP_BASE_URL) &&
    (process.env.NEXUS_FINANCE_ERP_ENV ?? 'sandbox') !== 'production'
  );
}
