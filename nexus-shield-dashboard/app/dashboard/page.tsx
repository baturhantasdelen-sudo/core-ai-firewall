import { CheckCircle2, KeyRound, ScanSearch, ShieldAlert } from 'lucide-react';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { UsageLimitCard } from '@/components/dashboard/UsageLimitCard';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { ScanHistoryTable } from '@/components/dashboard/ScanHistoryTable';
import { mockApiKey, mockMetrics, mockScans, mockUsage } from '@/lib/mock-dashboard-data';

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-7xl space-y-8 px-6 py-10">
        <DashboardHeader apiKey={mockApiKey} />

        <UsageLimitCard used={mockUsage.used} limit={mockUsage.limit} plan={mockUsage.plan} />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            icon={ScanSearch}
            label="Total Scans Executed"
            value={mockMetrics.totalScans.toString()}
          />
          <MetricCard
            icon={KeyRound}
            label="Active Secrets Blocked"
            value={mockMetrics.secretsBlocked.toString()}
            accent="red"
          />
          <MetricCard
            icon={ShieldAlert}
            label="PII Leaks Blocked"
            value={mockMetrics.piiLeaksBlocked.toString()}
            accent="yellow"
          />
          <MetricCard
            icon={CheckCircle2}
            label="Security Compliance Score"
            value={`${mockMetrics.complianceScore}%`}
            accent="green"
          />
        </div>

        <ScanHistoryTable scans={mockScans} />
      </div>
    </div>
  );
}
