import Link from 'next/link';
import { ArrowLeft, TrendingUp } from 'lucide-react';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { InvestorGrowthDashboard } from '@/components/investor/InvestorGrowthDashboard';

export const metadata = {
  title: 'Investor Growth Dashboard | Nexus Shield',
  description:
    'Real-time Nexus Shield growth metrics — scanned agents, tool call analysis, blocked actions, and sub-10ms intercept latency.',
};

export default function InvestorPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-white/5 bg-zinc-950/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <BrandLogo size={32} />
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-zinc-400 transition hover:text-zinc-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-12">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/5 px-4 py-1.5 text-xs font-medium text-cyan-300">
            <TrendingUp className="h-3.5 w-3.5" />
            Module 5 — Investor Growth Dashboard
          </div>
          <h1 className="mt-6 text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
            Nexus Shield Growth Metrics
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm text-zinc-500 sm:text-base">
            Live fleet telemetry for investors — adoption, intercept performance, and blocked
            attack volume across the Nexus Shield network.
          </p>
        </div>

        <div className="mt-10">
          <InvestorGrowthDashboard />
        </div>
      </main>
    </div>
  );
}
