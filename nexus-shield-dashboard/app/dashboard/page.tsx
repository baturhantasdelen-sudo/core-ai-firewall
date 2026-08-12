import { CheckCircle2, KeyRound, ScanSearch, ShieldAlert, ShieldQuestion } from 'lucide-react';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { UsageLimitCard } from '@/components/dashboard/UsageLimitCard';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { ScanHistoryTable } from '@/components/dashboard/ScanHistoryTable';
import { getOrganizationById, getOrgUsageSummary, derivePlanId } from '@/lib/org-metrics';
import { getPlanConfig } from '@/config/plans';
import { getRecentScans, getScanMetrics } from '@/lib/scans';
import { DEMO_ORG_ID } from '@/lib/demo-org';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const org = await getOrganizationById(DEMO_ORG_ID);

  if (!org) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100">
        <div className="mx-auto max-w-4xl px-6 py-10">
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/40 p-10 text-center">
            <ShieldQuestion className="h-8 w-8 text-zinc-600" />
            <h2 className="text-lg font-semibold text-zinc-200">Organizasyon bulunamadı</h2>
            <p className="max-w-md text-sm text-zinc-500">
              Sabit demo organizasyonu (<code>{DEMO_ORG_ID}</code>) veritabanında bulunamadı.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const [usage, metrics, scans] = await Promise.all([
    getOrgUsageSummary(org.id),
    getScanMetrics(org.id),
    getRecentScans(org.id),
  ]);

  const planId = derivePlanId(org.stripe_subscription_status);
  const plan = getPlanConfig(planId);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-7xl space-y-8 px-6 py-10">
        <DashboardHeader apiKey={org.api_key ?? 'nex_no_api_key_configured'} />

        <UsageLimitCard used={usage.scansThisMonth} limit={plan.maxScansPerMonth} plan={planId === 'pro' ? 'pro' : 'free'} />

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
