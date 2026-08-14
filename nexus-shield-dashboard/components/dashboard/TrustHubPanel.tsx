'use client';

import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  ArrowRight,
  Brain,
  FileCheck2,
  GitBranch,
  Shield,
  ShieldCheck,
  ShieldX,
  Users,
} from 'lucide-react';
import type { TrustHubSnapshot } from '@/lib/mock-trust-hub-data';
import { getTrustHubSummary } from '@/lib/mock-trust-hub-data';

interface TrustHubPanelProps {
  snapshot: TrustHubSnapshot;
}

function reputationTone(score: number): string {
  if (score >= 80) return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
  if (score >= 60) return 'text-amber-400 border-amber-500/30 bg-amber-500/10';
  if (score >= 40) return 'text-orange-400 border-orange-500/30 bg-orange-500/10';
  return 'text-rose-400 border-rose-500/30 bg-rose-500/10';
}

function riskBadgeTone(badge: string): string {
  switch (badge) {
    case 'LOW':
      return 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10';
    case 'MEDIUM':
      return 'text-amber-300 border-amber-500/30 bg-amber-500/10';
    case 'HIGH':
      return 'text-orange-300 border-orange-500/30 bg-orange-500/10';
    default:
      return 'text-rose-300 border-rose-500/30 bg-rose-500/10';
  }
}

function statusTone(status: string): string {
  if (status === 'VERIFIED' || status === 'CLEAN' || status === 'CLEAR') {
    return 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10';
  }
  if (status === 'FLAGGED' || status === 'MONITORING' || status === 'QUARANTINED') {
    return 'text-amber-300 border-amber-500/30 bg-amber-500/10';
  }
  if (status === 'ALLOW_DELEGATION') {
    return 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10';
  }
  if (status === 'REQUIRE_HUMAN_APPROVAL') {
    return 'text-amber-300 border-amber-500/30 bg-amber-500/10';
  }
  return 'text-rose-300 border-rose-500/30 bg-rose-500/10';
}

function delegationLabel(recommendation: string): string {
  switch (recommendation) {
    case 'ALLOW_DELEGATION':
      return 'Allow';
    case 'REQUIRE_HUMAN_APPROVAL':
      return 'Human Approval';
    default:
      return 'Deny';
  }
}

function strengthBar(strength: number): string {
  if (strength >= 80) return 'bg-emerald-500';
  if (strength >= 65) return 'bg-amber-500';
  if (strength > 0) return 'bg-orange-500';
  return 'bg-rose-500';
}

export function TrustHubPanel({ snapshot }: TrustHubPanelProps) {
  const summary = getTrustHubSummary(snapshot);
  const blockedTrajectories = snapshot.trajectoryAnalyses.filter(
    (entry) => entry.status === 'BLOCKED',
  ).length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Avg Trust Score" value={`${summary.avgReputation}/100`} icon={ShieldCheck} />
        <MetricCard label="Blocked Tool Chains" value={String(blockedTrajectories)} icon={GitBranch} tone="rose" />
        <MetricCard label="Unverified Actions" value={String(summary.unverifiedEvidence)} icon={FileCheck2} tone="amber" />
        <MetricCard label="Memory / Quarantine Alerts" value={String(summary.memoryAlerts)} icon={Brain} tone="violet" />
      </div>

      <section className="rounded-2xl border border-white/10 bg-zinc-950/60">
        <header className="flex items-center gap-2 border-b border-white/10 px-5 py-4">
          <Shield className="h-4 w-4 text-cyan-400" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
            Agent Reputation Cards
          </h2>
        </header>
        <div className="grid gap-4 p-5 md:grid-cols-3">
          {snapshot.reputations.map((card) => (
            <article
              key={card.agentId}
              className="rounded-xl border border-white/10 bg-zinc-900/60 p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium text-zinc-100">{card.agentId}</p>
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${reputationTone(card.reputationScore)}`}
                >
                  {card.reputationScore}/100
                </span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${riskBadgeTone(card.riskBadge)}`}
                >
                  Risk: {card.riskBadge}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-zinc-500">
                <MetricPill label="Success Rate" value={`${card.metrics.successRate}%`} />
                <MetricPill label="Blocked Violations" value={String(card.metrics.blockedViolations)} />
                <MetricPill label="Evidence Ratio" value={`${card.metrics.evidenceVerificationRatio}%`} />
                <MetricPill label="Memory Integrity" value={`${card.metrics.memoryIntegrityScore}%`} />
              </div>
              <p className="mt-2 text-xs text-zinc-500">
                {card.successfulActions} successful · {card.violations} violations ·{' '}
                {card.incidents.length} incidents
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-zinc-950/60">
        <header className="flex items-center gap-2 border-b border-white/10 px-5 py-4">
          <Users className="h-4 w-4 text-violet-400" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
            Inter-Agent Trust Delegation Flow
          </h2>
        </header>
        <div className="divide-y divide-white/5">
          {snapshot.delegationFlows.map((flow) => (
            <article key={flow.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
              <span className="font-mono text-xs text-cyan-300">{flow.sourceAgentId}</span>
              <ArrowRight className="h-3.5 w-3.5 text-zinc-600" />
              <span className="font-mono text-xs text-violet-300">{flow.targetAgentId}</span>
              <span
                className={`ml-auto rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${statusTone(flow.recommendation)}`}
              >
                {delegationLabel(flow.recommendation)}
              </span>
              <span className="text-[11px] text-zinc-500">Trust {flow.trustScore}/100</span>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-zinc-950/60">
        <header className="flex items-center gap-2 border-b border-white/10 px-5 py-4">
          <GitBranch className="h-4 w-4 text-rose-400" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
            Tool-Chain Trajectory Analysis
          </h2>
        </header>
        <div className="divide-y divide-white/5">
          {snapshot.trajectoryAnalyses.map((entry) => (
            <article key={entry.agentId} className="px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-zinc-100">{entry.agentName}</p>
                  <p className="font-mono text-xs text-zinc-500">{entry.agentId}</p>
                </div>
                <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusTone(entry.status)}`}>
                  {entry.status}
                </span>
              </div>
              <p className="mt-3 text-sm text-zinc-400">
                Pattern: <span className="text-cyan-300">{entry.pattern}</span> · Risk {entry.riskScore}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {entry.trajectory.map((step, index) => (
                  <span
                    key={`${step.toolName}-${index}`}
                    className="rounded-lg border border-white/10 bg-zinc-900 px-2 py-1 font-mono text-[11px] text-zinc-400"
                  >
                    {step.toolName}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-white/10 bg-zinc-950/60">
          <header className="flex items-center gap-2 border-b border-white/10 px-5 py-4">
            <FileCheck2 className="h-4 w-4 text-amber-400" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
              Evidence Chain Verification Log
            </h2>
          </header>
          <div className="divide-y divide-white/5">
            {snapshot.evidenceChain.map((entry) => (
              <div key={entry.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-zinc-200">{entry.toolName}</p>
                    <p className="text-xs text-zinc-500">{entry.agentId}</p>
                    <p className="mt-1 text-xs text-zinc-500">Expected: {entry.evidenceType}</p>
                  </div>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusTone(entry.status)}`}>
                    {entry.status === 'VERIFIED' ? (
                      <span className="inline-flex items-center gap-1">
                        <ShieldCheck className="h-3 w-3" /> Verified
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        <ShieldX className="h-3 w-3" /> Unverified
                      </span>
                    )}
                  </span>
                </div>
                <div className="mt-3">
                  <div className="flex items-center justify-between text-[10px] text-zinc-500">
                    <span>Chain Strength</span>
                    <span>{entry.evidenceChainStrength}%</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className={`h-full rounded-full ${strengthBar(entry.evidenceChainStrength)}`}
                      style={{ width: `${entry.evidenceChainStrength}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-zinc-950/60">
          <header className="flex items-center gap-2 border-b border-white/10 px-5 py-4">
            <Brain className="h-4 w-4 text-violet-400" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
              Memory Integrity & Poisoning Quarantine
            </h2>
          </header>
          <div className="divide-y divide-white/5">
            {snapshot.memoryIntegrity.map((entry) => (
              <div key={entry.id} className="px-5 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-zinc-200">{entry.agentId}</p>
                    <p className="text-xs text-zinc-500">Source: {entry.source}</p>
                  </div>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusTone(entry.status)}`}>
                    {entry.status}
                  </span>
                </div>
                {entry.patterns.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {entry.patterns.map((pattern) => (
                      <span
                        key={pattern}
                        className="rounded bg-rose-500/10 px-2 py-0.5 font-mono text-[10px] text-rose-300"
                      >
                        {pattern}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-emerald-400">No poisoning patterns detected</p>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-cyan-500/20 bg-cyan-500/5 px-4 py-3 text-xs text-zinc-400">
        <Activity className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-400" />
        Katman 3 TRUST aggregates Evidence Chain verification, Memory Integrity guardrails, and
        Inter-Agent Reputation Network for multi-agent runtime governance.
      </div>
    </div>
  );
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/5 bg-zinc-950/60 px-2 py-1.5">
      <p className="text-[10px] uppercase tracking-wide text-zinc-600">{label}</p>
      <p className="text-xs font-medium text-zinc-300">{value}</p>
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
  tone = 'cyan',
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  tone?: 'cyan' | 'rose' | 'amber' | 'violet';
}) {
  const tones = {
    cyan: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
    rose: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
    amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    violet: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4">
      <div className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border ${tones[tone]}`}>
        <Icon className="h-4 w-4" />
      </div>
      <p className="mt-3 text-xs uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-zinc-100">{value}</p>
    </div>
  );
}
