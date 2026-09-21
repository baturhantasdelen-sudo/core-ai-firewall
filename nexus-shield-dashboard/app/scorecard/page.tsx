import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, FileText, ShieldAlert, Terminal } from 'lucide-react';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { ScorecardDownloadActions } from '@/components/scorecard/ScorecardDownloadActions';
import { ScorecardMatrix } from '@/components/scorecard/ScorecardMatrix';
import {
  SCORECARD_2026,
  SCORECARD_DOCKER_CMD,
} from '@/lib/scorecard/scorecard-data';
import { getAbsoluteAppUrl } from '@/lib/site';

export const metadata: Metadata = {
  title: '2026 Enterprise AI Agent Security Scorecard | Nexus Shield',
  description:
    'Industry benchmark exposing insecure defaults in top AI agent frameworks against indirect prompt injection, tool abuse, and unauthorized actions — with Nexus Shield 99%+ mitigation under 12ms.',
  alternates: {
    canonical: getAbsoluteAppUrl('/scorecard'),
  },
};

export default function ScorecardPage() {
  const stats = SCORECARD_2026.headline_stats;

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

      <main className="mx-auto max-w-6xl px-6 py-16">
        <div className="inline-flex items-center gap-2 rounded-full border border-rose-500/25 bg-rose-500/5 px-3 py-1 text-xs font-medium text-rose-200">
          <ShieldAlert className="h-3.5 w-3.5" />
          Shadow AI · Insecure Defaults · Indirect Injection
        </div>

        <h1 className="mt-6 text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl lg:text-[2.65rem] lg:leading-tight">
          2026 Enterprise AI Agent Security Scorecard: Insecure Defaults &amp; Indirect Prompt
          Injection Risks
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-relaxed text-zinc-400">
          Independent evaluation matrix for the top 10 agent runtimes — measuring out-of-the-box
          defense against indirect hijacking, tool abuse, injection in tool parameters, and unsafe
          multi-agent delegation. Nexus Shield runtime control restores{' '}
          <span className="text-emerald-300">{stats.nexus_shield_mitigation_avg_pct}%+</span>{' '}
          mitigation at <span className="text-cyan-300">&lt;12ms</span> intercept latency.
        </p>

        <div className="mt-8 rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-500/10 via-zinc-900/60 to-zinc-950/80 p-6 backdrop-blur-md">
          <p className="text-sm font-semibold text-amber-100">
            {stats.enterprises_shadow_ai_default_pct}% of enterprises deploy AI agents with
            out-of-the-box defaults. {stats.agents_vulnerable_indirect_hijack_pct}% of those agents
            are vulnerable to indirect prompt hijacking.
          </p>
          <p className="mt-2 text-xs text-zinc-500">
            Average framework defense without runtime control:{' '}
            <strong className="text-rose-300">{stats.ootb_defense_rate_avg_pct}%</strong> (
            {stats.ootb_defense_rate_range_pct[0]}–{stats.ootb_defense_rate_range_pct[1]}% range
            across vectors).
          </p>
        </div>

        <section className="mt-14">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-100">
            <FileText className="h-5 w-5 text-cyan-400" />
            Interactive evaluation matrix
          </h2>
          <p className="mt-2 text-sm text-zinc-500">
            Expand any framework for per-vector comparison: insecure default (FAIL/PARTIAL) vs
            protected with Nexus Shield (PASS · ~12ms), intent divergence, READ_ONLY revocation, and
            MCP-SEC-SCORE evidence IDs.
          </p>
          <div className="mt-8">
            <ScorecardMatrix />
          </div>
        </section>

        <section className="mt-16 rounded-2xl border border-white/10 bg-zinc-900/50 p-8 backdrop-blur-md">
          <h2 className="text-lg font-semibold text-zinc-100">CISO outreach &amp; local audit</h2>
          <p className="mt-2 text-sm text-zinc-400">
            Share the executive summary with security leadership or reproduce the full scorecard in
            your CI pipeline — no Nexus Shield account required.
          </p>
          <div className="mt-6">
            <ScorecardDownloadActions />
          </div>
          <p className="mt-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            <Terminal className="h-4 w-4" />
            Run local audit (Docker)
          </p>
          <pre className="mt-3 overflow-x-auto rounded-lg border border-white/10 bg-black/40 p-4 text-xs text-emerald-300">
            {SCORECARD_DOCKER_CMD}
          </pre>
        </section>
      </main>
    </div>
  );
}
