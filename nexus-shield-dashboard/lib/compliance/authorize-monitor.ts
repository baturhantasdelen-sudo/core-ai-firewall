import type { NextRequest } from 'next/server';
import { authenticateApiKey, extractApiKey } from '@/lib/auth/api-key';

export async function authorizeComplianceMonitor(req: NextRequest): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const monitorToken = process.env.COMPLIANCE_MONITOR_TOKEN?.trim();
  const headerToken = req.headers.get('x-compliance-monitor-token')?.trim();

  if (monitorToken && headerToken && headerToken === monitorToken) {
    return { ok: true };
  }

  const apiKey = extractApiKey(req);
  if (apiKey) {
    try {
      const org = await authenticateApiKey(apiKey);
      if (org) return { ok: true };
    } catch {
      return { ok: false, status: 503, error: 'API key verification unavailable' };
    }
  }

  if (monitorToken) {
    return { ok: false, status: 401, error: 'Unauthorized: invalid x-compliance-monitor-token or x-api-key' };
  }

  // Dev-friendly fallback when no monitor token configured — still require API key.
  return { ok: false, status: 401, error: 'Unauthorized: set COMPLIANCE_MONITOR_TOKEN or provide x-api-key' };
}
