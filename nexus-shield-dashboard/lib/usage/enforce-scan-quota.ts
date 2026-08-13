import { PLAN_SCAN_LIMITS } from '@/config/plans';
import { derivePlanId, getOrgUsageSummary, type OrgRecord } from '@/lib/org-metrics';

export interface ScanQuotaSnapshot {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
}

export async function enforceScanQuota(org: OrgRecord): Promise<ScanQuotaSnapshot> {
  const usage = await getOrgUsageSummary(org.id);
  const plan = derivePlanId(org.stripe_subscription_status);
  const limit = org.monthly_scan_limit || PLAN_SCAN_LIMITS[plan];
  const used = usage.scansThisMonth;
  const remaining = Math.max(0, limit - used);

  return {
    allowed: used < limit,
    used,
    limit,
    remaining,
  };
}

export function scanQuotaExceededResponse(snapshot: ScanQuotaSnapshot) {
  return {
    error: 'Usage Limit Exceeded',
    code: 'SCAN_LIMIT_EXCEEDED',
    used: snapshot.used,
    limit: snapshot.limit,
    upgrade_url: '/#pricing',
  };
}
