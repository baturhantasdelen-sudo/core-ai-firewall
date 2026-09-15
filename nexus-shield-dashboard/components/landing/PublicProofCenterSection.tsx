'use client';

import { useEffect, useState } from 'react';
import {
  Activity,
  Gauge,
  Loader2,
  ShieldCheck,
  Target,
  Users,
  Zap,
} from 'lucide-react';
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
            Investor-grade, verifiable runtime metrics — agent safety, accuracy, sub-10ms intercept latency,
            and cryptographically signed evidence chains.
          </p>
        </div>

        <div className="mt-10 grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
          <MetricBlock title="Agent Safety & Trajectory Benchmark" icon={Users}>
            <StatRow label="Agents Tested" value={agentSafety.agentsTested.toLocaleString()} />
            <StatRow label="Tool Calls Analyzed" value={agentSafety.toolCallsAnalyzed.toLocaleString()} />
            <StatRow
              label="Dangerous Actions Blocked"
              value={`${agentSafety.dangerousBlocked.toLocaleString()} / ${agentSafety.dangerousTotal.toLocaleString()} (${agentSafety.blockRatePct}%)`}
            />
          </MetricBlock>

          <MetricBlock title="Accuracy & Resilience" icon={Target}>
            <StatRow label="Intent/Action Misalignment Detection" value={`${accuracy.intentMisalignmentPct}%`} />
            <StatRow label="Tool Misuse & Parameter Hijack" value={`${accuracy.toolMisusePct}%`} />
            <StatRow label="Privilege Escalation Block Rate" value={`${accuracy.privilegeEscalationPct}%`} />
            <StatRow
              label="False Positive / Negative Rate"
              value={`${accuracy.falsePositivePct}% | ${accuracy.falseNegativePct}%`}
            />
          </MetricBlock>

          <MetricBlock title="Runtime Latency (Sub-10ms Certified)" icon={Zap}>
            <StatRow label="p50" value={`${latency.p50Ms.toFixed(1)} ms`} />
            <StatRow label="p95" value={`${latency.p95Ms.toFixed(1)} ms`} />
            <StatRow label="p99" value={`${latency.p99Ms.toFixed(1)} ms`} />
            {latency.certifiedSub10ms ? (
              <span className="mt-2 inline-flex rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
                Certified Sub-10ms Runtime Intercept
              </span>
            ) : null}
          </MetricBlock>

          <MetricBlock title="Attack Scenarios & Evidence" icon={ShieldCheck}>
            <StatRow label="MCP Attack Scenarios Tested" value={attackEvidence.mcpScenariosTested} />
            <StatRow
              label="Cryptographically Verified Evidence Chains"
              value={attackEvidence.verifiedEvidenceChains.toLocaleString()}
            />
            <div className="pt-2 text-xs text-zinc-500">
              <Activity className="mr-1 inline h-3 w-3 text-cyan-400" />
              Every blocked action produces an immutable SHA-256 evidence bundle.
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
