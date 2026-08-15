'use client';

import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  Fingerprint,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  TrendingDown,
  Wifi,
} from 'lucide-react';
import type { ProveTrustSnapshot } from '@/lib/mock-prove-trust-data';
import { getProveTrustSummary } from '@/lib/mock-prove-trust-data';
import type { TrustTier } from '@/lib/engine/reputation/dynamic-trust-score';
import type { VerificationStatus } from '@/lib/engine/evidence/evidential-verifier';

interface ProveTrustPanelProps {
  snapshot: ProveTrustSnapshot;
}

function verificationTone(status: VerificationStatus): string {
  switch (status) {
    case 'VERIFIED':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
    case 'INSUFFICIENT_EVIDENCE':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-300';
    default:
      return 'border-rose-500/30 bg-rose-500/10 text-rose-300';
  }
}

function tierTone(tier: TrustTier): string {
  switch (tier) {
    case 'NORMAL':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
    case 'ELEVATED':
      return 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300';
    case 'RESTRICTED':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-300';
    default:
      return 'border-rose-500/30 bg-rose-500/10 text-rose-300';
  }
}

function tierThresholdLabel(tier: TrustTier): string {
  switch (tier) {
    case 'NORMAL':
      return '90+ — Full authority';
    case 'ELEVATED':
      return '70–89 — Sensitive ops monitored';
    case 'RESTRICTED':
      return '40–69 — PAYMENT/EXPORT blocked, WRITE → approval';
    default:
      return '<40 — Agent FROZEN';
  }
}

function scoreBarColor(score: number): string {
  if (score >= 90) return 'bg-emerald-500';
  if (score >= 70) return 'bg-cyan-500';
  if (score >= 40) return 'bg-amber-500';
  return 'bg-rose-500';
}

export function ProveTrustPanel({ snapshot }: ProveTrustPanelProps) {
  const summary = getProveTrustSummary(snapshot);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ProveMetricCard label="Verified Outcomes" value={String(summary.verified)} icon={ShieldCheck} tone="emerald" />
        <ProveMetricCard label="Unverified Actions" value={String(summary.unverified)} icon={ShieldX} tone="rose" />
        <ProveMetricCard label="Frozen Agents" value={String(summary.frozenAgents)} icon={ShieldAlert} tone="violet" />
        <ProveMetricCard label="Immune Signatures" value={String(summary.immuneSignatures)} icon={Wifi} tone="cyan" />
      </div>

      <section className="rounded-2xl border border-white/10 bg-zinc-950/60">
        <header className="flex items-center gap-2 border-b border-white/10 px-5 py-4">
          <Fingerprint className="h-4 w-4 text-amber-400" />
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
              Evidential Outcome Verification Log
            </h2>
            <p className="mt-0.5 text-xs text-zinc-500">
              Transaction ID · Bank API Response · DB Hash · Execution Log · Agent Signature
            </p>
          </div>
        </header>
        <div className="divide-y divide-white/5">
          {snapshot.evidentialLogs.map((entry) => (
            <article key={entry.id} className="px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-zinc-100">{entry.agentName}</p>
                  <p className="font-mono text-xs text-zinc-500">{entry.toolName}</p>
                </div>
                <span
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${verificationTone(entry.verificationStatus)}`}
                >
                  {entry.verificationStatus}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between text-[10px] text-zinc-500">
                <span>Confidence</span>
                <span>{entry.confidenceScore}%</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-800">
                <div
                  className={`h-full rounded-full ${scoreBarColor(entry.confidenceScore)}`}
                  style={{ width: `${entry.confidenceScore}%` }}
                />
              </div>
              {entry.missingProofs.length > 0 ? (
                <div className="mt-3">
                  <p className="text-[10px] uppercase tracking-wide text-zinc-600">Missing proofs</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {entry.missingProofs.map((proof) => (
                      <span
                        key={proof}
                        className="rounded border border-rose-500/20 bg-rose-500/5 px-2 py-0.5 font-mono text-[10px] text-rose-300"
                      >
                        {proof}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-xs text-emerald-400">All required proofs satisfied</p>
              )}
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-zinc-950/60">
        <header className="flex items-center gap-2 border-b border-white/10 px-5 py-4">
          <TrendingDown className="h-4 w-4 text-cyan-400" />
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
              Dynamic Real-Time Trust Score
            </h2>
            <p className="mt-0.5 text-xs text-zinc-500">
              Instant score drops on suspicious activity — tier thresholds enforce runtime restrictions
            </p>
          </div>
        </header>
        <div className="grid gap-4 p-5 lg:grid-cols-3">
          {snapshot.dynamicTrustScores.map((entry) => (
            <article key={entry.agentId} className="rounded-xl border border-white/10 bg-zinc-900/60 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-zinc-100">{entry.agentName}</p>
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${tierTone(entry.tier)}`}>
                  {entry.tier}
                </span>
              </div>
              <div className="mt-3 flex items-end gap-2">
                <p className="text-3xl font-semibold text-zinc-100">{entry.score}</p>
                {entry.previousScore !== undefined && entry.previousScore > entry.score ? (
                  <span className="mb-1 text-xs text-rose-400">
                    ↓ {entry.previousScore - entry.score}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-[10px] text-zinc-500">{tierThresholdLabel(entry.tier)}</p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-800">
                <div
                  className={`h-full rounded-full transition-all ${scoreBarColor(entry.score)}`}
                  style={{ width: `${entry.score}%` }}
                />
              </div>
              {entry.history.length > 1 ? (
                <div className="mt-3 flex items-end gap-0.5" style={{ height: 32 }}>
                  {entry.history.map((point, index) => (
                    <div
                      key={`${entry.agentId}-hist-${index}`}
                      className={`flex-1 rounded-t ${scoreBarColor(point.score)} opacity-80`}
                      style={{ height: `${Math.max(8, (point.score / 100) * 32)}px` }}
                      title={`${point.score} (${point.tier})`}
                    />
                  ))}
                </div>
              ) : null}
              {entry.restrictions.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-1">
                  {entry.restrictions.map((restriction) => (
                    <span
                      key={restriction}
                      className="rounded bg-zinc-950 px-1.5 py-0.5 font-mono text-[9px] text-orange-300"
                    >
                      {restriction}
                    </span>
                  ))}
                </div>
              ) : null}
            </article>
          ))}
        </div>
        <div className="border-t border-white/5 px-5 py-3">
          <div className="flex flex-wrap gap-4 text-[10px] text-zinc-500">
            <span><span className="text-emerald-400">■</span> 90+ NORMAL</span>
            <span><span className="text-cyan-400">■</span> 70–89 ELEVATED</span>
            <span><span className="text-amber-400">■</span> 40–69 RESTRICTED</span>
            <span><span className="text-rose-400">■</span> &lt;40 CRITICAL (FROZEN)</span>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5">
        <header className="flex items-center gap-2 border-b border-cyan-500/20 px-5 py-4">
          <Wifi className="h-4 w-4 text-cyan-400" />
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-cyan-200">
              Collective Digital Immune Network
            </h2>
            <p className="mt-0.5 text-xs text-cyan-200/60">
              Zero-Knowledge threat signatures — One Customer Learns → Every Customer Benefits
            </p>
          </div>
        </header>
        <div className="divide-y divide-white/5">
          {snapshot.immuneSignatureFeed.map((entry) => (
            <article key={entry.id} className="flex flex-wrap items-start gap-4 px-5 py-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-bold text-cyan-300">{entry.id}</span>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                      entry.severity === 'CRITICAL'
                        ? 'border-rose-500/30 bg-rose-500/10 text-rose-300'
                        : 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                    }`}
                  >
                    {entry.severity}
                  </span>
                  <span className="rounded bg-zinc-900 px-2 py-0.5 text-[10px] text-zinc-400">
                    {entry.category}
                  </span>
                </div>
                <p className="mt-1 font-mono text-[10px] text-zinc-600">hash:{entry.signatureHash}</p>
                <div className="mt-2 flex flex-wrap items-center gap-1">
                  {entry.anonymizedPattern.map((step, index) => (
                    <span key={`${entry.id}-${step}-${index}`} className="inline-flex items-center gap-1">
                      <code className="rounded bg-zinc-900/80 px-1.5 py-0.5 text-[10px] text-violet-300">
                        {step}
                      </code>
                      {index < entry.anonymizedPattern.length - 1 ? (
                        <span className="text-zinc-600">→</span>
                      ) : null}
                    </span>
                  ))}
                </div>
              </div>
              <div className="text-right text-xs text-zinc-500">
                <p>{entry.networkReach} nodes</p>
                <p className="mt-0.5">{new Date(entry.syncedAt).toLocaleTimeString()}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <div className="flex items-start gap-2 rounded-xl border border-cyan-500/20 bg-cyan-500/5 px-4 py-3 text-xs text-zinc-400">
        <Activity className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-400" />
        Katman 3 PROVE &amp; TRUST — Evidential outcome verification, dynamic real-time trust scoring,
        and collective zero-knowledge immune network propagation.
      </div>
    </div>
  );
}

function ProveMetricCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  tone: 'emerald' | 'rose' | 'violet' | 'cyan';
}) {
  const toneClass =
    tone === 'emerald'
      ? 'text-emerald-400'
      : tone === 'rose'
        ? 'text-rose-400'
        : tone === 'violet'
          ? 'text-violet-400'
          : 'text-cyan-400';

  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-400">{label}</p>
        <Icon className={`h-4 w-4 ${toneClass}`} />
      </div>
      <p className="mt-2 text-3xl font-semibold text-zinc-100">{value}</p>
    </div>
  );
}
