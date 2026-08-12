'use client';

import Link from 'next/link';
import { ArrowRight, CheckCircle2, KeyRound, ScanSearch, ShieldAlert } from 'lucide-react';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { ScanHistoryTable } from '@/components/dashboard/ScanHistoryTable';
import { mockMetrics, mockScans } from '@/lib/mock-dashboard-data';

export function DashboardPreview() {
  return (
    <section id="dashboard" className="scroll-mt-20 mx-auto max-w-7xl px-6 py-20">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight text-zinc-100 sm:text-4xl">
            SOC &amp; Telemetry Dashboard
          </h2>
          <p className="mt-3 max-w-2xl text-sm text-zinc-500 sm:text-base">
            Interactive preview of scan telemetry, secret blocks, and compliance scoring. Sign in
            for live org data from Supabase.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-zinc-900/80 px-4 py-2.5 text-sm font-semibold text-zinc-200 transition-colors hover:border-white/20 hover:bg-zinc-900"
        >
          Go to App
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300">
        Demo mode — sample telemetry data
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard icon={ScanSearch} label="Total Scans Executed" value={mockMetrics.totalScans.toString()} />
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

      <div className="mt-6">
        <ScanHistoryTable scans={mockScans.slice(0, 4)} />
      </div>
    </section>
  );
}
