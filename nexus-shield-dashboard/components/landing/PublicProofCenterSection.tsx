'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  Activity,
  ArrowRight,
  ExternalLink,
  Gauge,
  Loader2,
  ShieldCheck,
  Target,
  Users,
  Zap,
} from 'lucide-react';
import {
  NEXUS_HARNESS_FALSE_POSITIVE_NOTE,
  NEXUS_HARNESS_LATENCY_FOOTNOTE,
  NEXUS_HARNESS_METRICS_LABEL,
} from '@/lib/brand/copy-standards';
import { APP_DOC_ROUTES, BENCHMARK_GITHUB_URL } from '@/lib/site';
import { fetchPublicProofCenter } from '@/lib/public-proof-center';
import type { PublicProofCenterView } from '@/types/public-proof-center';
import { PUBLIC_PROOF_DEFAULTS } from '@/types/public-proof-center';
import { ProveItDemoCard } from '@/components/landing/ProveItDemoCard';

function MetricBlock({
  title,
  children,
  icon: Icon,
}: {
  title: string;
  children: React.ReactNode;
  icon: typeof Gauge;
}) {
  return (
    <article className="rounded-2xl border border-white/10 bg-zinc-950/70 p-5 backdrop-blur-sm">
      <div className="mb-4 flex items-center gap-2">
        <div className="rounded-lg border border-white/10 bg-zinc-900/80 p-2">
          <Icon className="h-4 w-4 text-cyan-400" />
        </div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">{title}</h3>
      </div>
      <div className="space-y-2 text-sm text-zinc-300">{children}</div>
    </article>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/5 pb-2 last:border-0 last:pb-0">
      <span className="text-zinc-500">{label}</span>
      <span className="font-mono text-sm font-semibold text-zinc-100">{value}</span>
    </div>
  );
}

export function PublicProofCenterSection({ compact = false }: { compact?: boolean }) {
  const [metrics, setMetrics] = useState<PublicProofCenterView>(PUBLIC_PROOF_DEFAULTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetchPublicProofCenter().then((data) => {
      setMetrics(data);
      setLoading(false);
    });
  }, []);

  const { agentSafety, accuracy, latency, attackEvidence } = metrics;

  return (
    <section
      id="proof-center"
      className={`scroll-mt-20 border-y border-white/5 bg-gradient-to-b from-zinc-950 via-zinc-900/40 to-zinc-950 ${compact ? 'py-12' : 'py-20'}`}
    >
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
            <Gauge className="h-3.5 w-3.5" />
            Public Proof Center
            {loading ? (
              <Loader2 className="ml-1 h-3 w-3 animate-spin" />
            ) : metrics.source === 'live_api' ? (
              <span className="ml-1 text-emerald-400">· Live API</span>
            ) : (
              <span className="ml-1 text-zinc-500">· Verified Benchmarks</span>
            )}
          </div>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
            Nexus Shield Proof Center
          </h2>
          <p className="mt-3 text-sm text-zinc-400 sm:text-base">
            Open-source <strong className="font-medium text-zinc-300">harness benchmark</strong> metrics
            ({NEXUS_HARNESS_METRICS_LABEL}) — separate from your production{' '}
            <strong className="font-medium text-zinc-300">UAR ledger</strong> on the data plane.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href={APP_DOC_ROUTES.benchmark}
              className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-5 py-2.5 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-500/15"
            >
              Read Methodology &amp; Benchmark Paper
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href={BENCHMARK_GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-medium text-zinc-500 transition hover:text-zinc-300"
            >
              Open-source harness on GitHub
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
          <p className="mt-4 text-xs leading-relaxed text-zinc-600">
            *Tested across 500+ MCP attack scenarios &amp; multi-agent execution graphs. Open-source
            benchmark harness available on GitHub — OWASP GenAI / Agentic tags on every scenario.
          </p>
        </div>

        <div className="mt-10 grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
          <MetricBlock title="Harness · Agent Safety" icon={Users}>
            <StatRow
              label="Harness agents evaluated (baseline fixture)"
              value={agentSafety.agentsTested.toLocaleString()}
            />
            <StatRow
              label="Harness trajectory steps evaluated"
              value={agentSafety.toolCallsAnalyzed.toLocaleString()}
            />
            <StatRow
              label="Dangerous Actions Blocked"
              value={`${agentSafety.dangerousBlocked.toLocaleString()} / ${agentSafety.dangerousTotal.toLocaleString()} (${agentSafety.blockRatePct}%)`}
            />
          </MetricBlock>

          <MetricBlock title="Harness · Scenario accuracy" icon={Target}>
            <StatRow
              label="Intent/action misalignment (harness scenarios)"
              value={`${accuracy.intentMisalignmentPct}%`}
            />
            <StatRow label="Tool misuse & hijack (harness)" value={`${accuracy.toolMisusePct}%`} />
            <StatRow label="Privilege escalation blocks (harness)" value={`${accuracy.privilegeEscalationPct}%`} />
            <StatRow
              label="False positive / negative (harness)"
              value={
                accuracy.falsePositivePct < 0
                  ? NEXUS_HARNESS_FALSE_POSITIVE_NOTE
                  : `${accuracy.falsePositivePct}% | ${accuracy.falseNegativePct}% (controlled vectors)`
              }
            />
          </MetricBlock>

          <MetricBlock title="Harness · Runtime latency" icon={Zap}>
            <StatRow label="p50" value={`${latency.p50Ms.toFixed(1)} ms`} />
            <StatRow label="p95" value={`${latency.p95Ms.toFixed(1)} ms`} />
            <StatRow label="p99" value={`${latency.p99Ms.toFixed(1)} ms`} />
            <p className="pt-2 text-[10px] lowercase leading-relaxed text-zinc-500">
              {NEXUS_HARNESS_LATENCY_FOOTNOTE}
            </p>
          </MetricBlock>

          <MetricBlock title="Attack Scenarios & Evidence" icon={ShieldCheck}>
            <StatRow label="MCP Attack Scenarios Tested" value={attackEvidence.mcpScenariosTested} />
            <StatRow
              label="Harness evidence bundles (evaluated trajectories)"
              value={attackEvidence.verifiedEvidenceChains.toLocaleString()}
            />
            <div className="pt-2 text-xs leading-relaxed text-zinc-500">
              <Activity className="mr-1 inline h-3 w-3 text-cyan-400" />
              Harness runs emit tamper-evident SHA-256 bundles per evaluated trajectory step (ALLOW,
              BLOCK, READ_ONLY, REQUIRE_APPROVAL). Counts match{' '}
              <span className="text-zinc-400">trajectory steps evaluated</span>, not blocked actions
              alone — see{' '}
              <code className="text-zinc-400">harness/fixtures/sample-output.json</code>.
            </div>
          </MetricBlock>
        </div>

        {!compact ? (
          <div className="mt-8">
            <ProveItDemoCard />
          </div>
        ) : null}
      </div>
    </section>
  );
}
