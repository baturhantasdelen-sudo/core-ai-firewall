import { redirect } from 'next/navigation';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { CheckoutSessionVerifier } from '@/components/dashboard/CheckoutSessionVerifier';
import { LiveDashboardPanel } from '@/components/dashboard/LiveDashboardPanel';
import { getOrgUsageSummary, derivePlanId } from '@/lib/org-metrics';
import { getPlanConfig } from '@/config/plans';
import { getRecentScans, getScanMetrics } from '@/lib/scans';
import { getAuthContext } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

interface DashboardPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

function resolveSessionId(params: Record<string, string | string[] | undefined>): string | null {
  const value = params.session_id;
  if (typeof value === 'string' && value.trim()) return value.trim();
  return null;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const auth = await getAuthContext();
  if (!auth) {
    redirect('/login?next=/dashboard');
  }

  const resolvedSearchParams = await searchParams;
  const checkoutSessionId = resolveSessionId(resolvedSearchParams);

  const org = auth.org;

  const [usage, metrics, scans] = await Promise.all([
    getOrgUsageSummary(org.id),
    getScanMetrics(org.id),
    getRecentScans(org.id),
  ]);

  const planId = derivePlanId(org.stripe_subscription_status);
  const plan = getPlanConfig(planId);
  const usageLimit = org.monthly_scan_limit || plan.maxScansPerMonth;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-7xl space-y-8 px-6 py-10">
        <DashboardHeader apiKey={org.api_key ?? 'nex_no_api_key_configured'} />

        {checkoutSessionId ? <CheckoutSessionVerifier sessionId={checkoutSessionId} /> : null}

        <LiveDashboardPanel
          orgId={org.id}
          initialScans={scans}
          initialMetrics={metrics}
          initialUsageUsed={usage.scansThisMonth}
          usageLimit={usageLimit}
          plan={planId === 'pro' ? 'pro' : 'free'}
        />
      </div>
    </div>
  );
}
