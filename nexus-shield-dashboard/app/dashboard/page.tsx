import { redirect } from 'next/navigation';
import { CheckCircle2, KeyRound, ScanSearch, ShieldAlert } from 'lucide-react';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { UsageLimitCard } from '@/components/dashboard/UsageLimitCard';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { ScanHistoryTable } from '@/components/dashboard/ScanHistoryTable';
import { getOrgUsageSummary, derivePlanId } from '@/lib/org-metrics';
import { getPlanConfig } from '@/config/plans';
import { getRecentScans, getScanMetrics } from '@/lib/scans';
import { getAuthContext } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const auth = await getAuthContext();
  if (!auth) {
    redirect('/login?next=/dashboard');
  }

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

        <UsageLimitCard
          used={usage.scansThisMonth}
          limit={usageLimit}
          plan={planId === 'pro' ? 'pro' : 'free'}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard icon={ScanSearch} label="Total Scans Executed" value={metrics.totalScans.toString()} />
          <MetricCard
            icon={KeyRound}
            label="Active Secrets Blocked"
            value={metrics.secretsBlocked.toString()}
            accent="red"
          />
          <MetricCard
            icon={ShieldAlert}
            label="PII Leaks Blocked"
            value={metrics.piiLeaksBlocked.toString()}
            accent="yellow"
          />
          <MetricCard
            icon={CheckCircle2}
            label="Security Compliance Score"
            value={`${metrics.complianceScore}%`}
            accent="green"
          />
        </div>

        <ScanHistoryTable scans={scans} />
      </div>
    </div>
  );
}
