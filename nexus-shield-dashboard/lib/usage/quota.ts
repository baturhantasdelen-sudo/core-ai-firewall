import { randomUUID } from 'crypto';
import type { NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { startOfCurrentMonthIso } from '@/lib/date';
import { derivePlanId, type OrgRecord } from '@/lib/org-metrics';
import { PLAN_SCAN_LIMITS, type PlanId } from '@/config/plans';
import { getAuthContext } from '@/lib/auth/session';

export const VISITOR_COOKIE = 'nexus_visitor_id';
export const SANDBOX_TIMEOUT_MS = 10_000;

export interface UsageSnapshot {
  used: number;
  limit: number;
  remaining: number;
  plan: PlanId;
  allowed: boolean;
}

function resolveLimit(org: OrgRecord | null): number {
  if (!org) return PLAN_SCAN_LIMITS.free;
  const plan = derivePlanId(org.stripe_subscription_status);
  if (plan !== 'free') return org.monthly_scan_limit || PLAN_SCAN_LIMITS[plan];
  return org.monthly_scan_limit || PLAN_SCAN_LIMITS.free;
}

async function countMonthlyUsage(orgId: string | null, visitorId: string | null): Promise<number> {
  const supabase = getSupabaseAdmin();
  const since = startOfCurrentMonthIso();

  let total = 0;

  if (orgId) {
    const [scanCount, eventCount] = await Promise.all([
      supabase
        .from('scan_results')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .gte('created_at', since),
      supabase
        .from('usage_events')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .gte('created_at', since),
    ]);

    total += scanCount.count ?? 0;
    total += eventCount.count ?? 0;
  } else if (visitorId) {
    const { count } = await supabase
      .from('usage_events')
      .select('id', { count: 'exact', head: true })
      .eq('visitor_id', visitorId)
      .gte('created_at', since);

    total += count ?? 0;
  }

  return total;
}

export function getOrCreateVisitorId(req: NextRequest): { visitorId: string; isNew: boolean } {
  const existing = req.cookies.get(VISITOR_COOKIE)?.value;
  if (existing) return { visitorId: existing, isNew: false };
  return { visitorId: randomUUID(), isNew: true };
}

export async function getUsageSnapshot(
  org: OrgRecord | null,
  visitorId: string | null,
): Promise<UsageSnapshot> {
  const plan = org ? derivePlanId(org.stripe_subscription_status) : 'free';
  const limit = resolveLimit(org);
  const used = await countMonthlyUsage(org?.id ?? null, visitorId);
  const isPro = plan !== 'free';
  const allowed = isPro || used < limit;

  return {
    used,
    limit: isPro ? limit : limit,
    remaining: isPro ? limit - used : Math.max(0, limit - used),
    plan,
    allowed,
  };
}

export async function resolveUsageContext(req: NextRequest): Promise<{
  org: OrgRecord | null;
  visitorId: string;
  setVisitorCookie: boolean;
}> {
  const auth = await getAuthContext();
  const { visitorId, isNew } = getOrCreateVisitorId(req);
  return {
    org: auth?.org ?? null,
    visitorId,
    setVisitorCookie: isNew,
  };
}

export async function recordSandboxUsage(params: {
  orgId: string | null;
  visitorId: string;
  status: 'passed' | 'blocked';
  latencyMs: number;
}): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('usage_events').insert({
    org_id: params.orgId,
    visitor_id: params.orgId ? null : params.visitorId,
    event_type: 'sandbox',
    status: params.status,
    latency_ms: Math.round(params.latencyMs),
  });

  if (error) {
    console.error('Failed to record sandbox usage', error.message);
  }
}

export function usageLimitResponse(snapshot: UsageSnapshot) {
  return {
    error: 'Usage Limit Exceeded',
    code: 'USAGE_LIMIT_EXCEEDED',
    used: snapshot.used,
    limit: snapshot.limit,
    upgrade_url: '/#pricing',
  };
}
