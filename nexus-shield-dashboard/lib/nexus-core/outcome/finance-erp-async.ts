import { httpReadJson } from '@/lib/nexus-core/adapters/http-read';
import {
  financeErpResourceUrl,
  normalizeFinanceErpInvoicePayload,
  isFinanceErpLiveConfigured,
} from '@/lib/nexus-core/adapters/finance-erp-http';
import type { OutcomeVerifyRequest } from '@/lib/nexus-core/outcome/models';

const MAX_ATTEMPTS = 3;
const RETRY_MS = [500, 1000, 2000];

function authHeadersForFinanceErp(): Record<string, string> {
  const token = process.env.NEXUS_FINANCE_ERP_API_TOKEN?.trim();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

/** Async read-only Finance/ERP observation for verification pipeline. */
export async function fetchFinanceErpObservedState(
  req: OutcomeVerifyRequest,
): Promise<Record<string, unknown>> {
  if (req.observed_state_override) return { ...req.observed_state_override };
  if (req.adapter_id !== 'finance_erp_http') {
    throw new Error('fetchFinanceErpObservedState requires finance_erp_http adapter');
  }
  if (!req.resource_id) {
    throw new Error('resource_id required for Finance/ERP verification');
  }

  if (process.env.NEXUS_FINANCE_ERP_INLINE_FIXTURE) {
    return normalizeFinanceErpInvoicePayload(JSON.parse(process.env.NEXUS_FINANCE_ERP_INLINE_FIXTURE));
  }

  if (!isFinanceErpLiveConfigured()) {
    throw new Error(
      'Finance/ERP live read BLOCKED BY CONFIGURATION — set NEXUS_FINANCE_ERP_* sandbox vars or use mock adapter',
    );
  }

  const url = financeErpResourceUrl(req.resource_id);
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const res = await httpReadJson(url, {
        timeout_ms: Number(process.env.NEXUS_FINANCE_ERP_TIMEOUT_MS ?? 8000),
        max_bytes: Number(process.env.NEXUS_FINANCE_ERP_MAX_BYTES ?? 262144),
        headers: authHeadersForFinanceErp(),
      });
      if (res.status < 200 || res.status >= 300) {
        throw new Error(`Finance ERP HTTP ${res.status}`);
      }
      const normalized = normalizeFinanceErpInvoicePayload(res.body);
      return {
        ...normalized,
        transaction_id: normalized.invoice_id ?? req.resource_id,
        observed_via: 'finance_erp_http_async',
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < MAX_ATTEMPTS - 1) {
        await new Promise((r) => setTimeout(r, RETRY_MS[attempt] ?? 1000));
      }
    }
  }

  throw lastError ?? new Error('Finance ERP read failed');
}

export async function enrichRequestWithFinanceErpObservation(
  req: OutcomeVerifyRequest,
): Promise<OutcomeVerifyRequest> {
  if (req.adapter_id !== 'finance_erp_http') return req;
  if (req.observed_state_override || req.mock_fixture) return req;
  const observed = await fetchFinanceErpObservedState(req);
  return { ...req, observed_state_override: observed };
}
