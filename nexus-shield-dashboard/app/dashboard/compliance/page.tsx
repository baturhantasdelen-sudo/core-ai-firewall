import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, FileText, Scale } from 'lucide-react';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { ComplianceReportDownload } from '@/components/dashboard/ComplianceReportDownload';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { scoreToGrade, aggregatePiiStats } from '@/lib/reports/build-compliance-report';
import { getAuthContext } from '@/lib/auth/session';
import { getRecentScans, getScanMetrics } from '@/lib/scans';

export const dynamic = 'force-dynamic';

export default async function CompliancePage() {
  const auth = await getAuthContext();
  if (!auth) {
    redirect('/login?next=/dashboard/compliance');
  }

  const [scans, metrics] = await Promise.all([
    getRecentScans(auth.org.id, 50),
    getScanMetrics(auth.org.id),
  ]);

  const piiStats = aggregatePiiStats(scans);
  const grade = scoreToGrade(metrics.complianceScore);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-7xl space-y-8 px-6 py-10">
        <DashboardHeader apiKey={auth.org.api_key ?? 'nex_no_api_key_configured'} />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 text-xs text-zinc-500 transition hover:text-zinc-300"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Dashboard
            </Link>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-100">
              Compliance &amp; Audit
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              Enterprise KVKK / GDPR reporting for {auth.org.name}
            </p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-300">
            <Scale className="h-3.5 w-3.5" />
            Audit Center
          </span>
        </div>

        <ComplianceReportDownload
          organizationName={auth.org.name}
          securityGrade={grade}
          securityScore={metrics.complianceScore}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard icon={FileText} label="Total Scans Audited" value={metrics.totalScans.toString()} />
          <MetricCard
            icon={Scale}
            label="PII Events Masked"
            value={piiStats.totalMasked.toString()}
            accent="yellow"
          />
          <MetricCard
            icon={FileText}
            label="TCKN / IBAN / VKN"
            value={`${piiStats.tckn}/${piiStats.iban}/${piiStats.vkn}`}
            accent="yellow"
          />
          <MetricCard
            icon={FileText}
            label="Compliance Score"
            value={`${metrics.complianceScore}% (${grade})`}
            accent="green"
          />
        </div>

        <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-6">
          <h2 className="text-sm font-semibold text-zinc-200">Report Contents</h2>
          <ul className="mt-3 space-y-2 text-sm text-zinc-400">
            <li>• Executive summary aligned with KVKK Article 12 and BDDK data security guidance</li>
            <li>• Regional PII statistics: TCKN, IBAN, VKN, credit card, email, and phone masking counts</li>
            <li>• Violation risk table with severity and remediation status</li>
            <li>• Detailed findings list with masked previews — no raw secrets exported</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
