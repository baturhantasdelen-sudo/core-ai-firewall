'use client';

import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  Brain,
  FileCheck2,
  GitBranch,
  Shield,
  ShieldCheck,
  ShieldX,
} from 'lucide-react';
import type { TrustHubSnapshot } from '@/lib/mock-trust-hub-data';

interface TrustHubPanelProps {
  snapshot: TrustHubSnapshot;
}

function reputationTone(score: number): string {
  if (score >= 80) return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
  if (score >= 60) return 'text-amber-400 border-amber-500/30 bg-amber-500/10';
  if (score >= 40) return 'text-orange-400 border-orange-500/30 bg-orange-500/10';
  return 'text-rose-400 border-rose-500/30 bg-rose-500/10';
}

function statusTone(status: string): string {
  if (status === 'VERIFIED' || status === 'CLEAN' || status === 'CLEAR') {
    return 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10';
  }
  if (status === 'FLAGGED' || status === 'MONITORING') {
    return 'text-amber-300 border-amber-500/30 bg-amber-500/10';
  }
  return 'text-rose-300 border-rose-500/30 bg-rose-500/10';
}

export function TrustHubPanel({ snapshot }: TrustHubPanelProps) {
  const avgReputation = Math.round(
    snapshot.reputations.reduce((sum, record) => sum + record.score, 0) /
      Math.max(snapshot.reputations.length, 1),
  );
  const blockedTrajectories = snapshot.trajectoryAnalyses.filter(
    (entry) => entry.status === 'BLOCKED',
  ).length;
  const unverifiedEvidence = snapshot.evidenceChain.filter(
    (entry) => entry.status === 'UNVERIFIED_ACTION',
  ).length;
  const memoryIssues = snapshot.memoryIntegrity.filter((entry) => entry.status !== 'CLEAN').length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Avg Reputation" value={`${avgReputation}/100`} icon={ShieldCheck} />
        <MetricCard label="Blocked Tool Chains" value={String(blockedTrajectories)} icon={GitBranch} tone="rose" />
        <MetricCard label="Unverified Actions" value={String(unverifiedEvidence)} icon={FileCheck2} tone="amber" />
        <MetricCard label="Memory Integrity Alerts" value={String(memoryIssues)} icon={Brain} tone="violet" />
      </div>

      <section className="rounded-2xl border border-white/10 bg-zinc-950/60">
        <header className="flex items-center gap-2 border-b border-white/10 px-5 py-4">
          <Shield className="h-4 w-4 text-cyan-400" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
            Agent Reputation Scores
          </h2>
        </header>
        <div className="grid gap-4 p-5 md:grid-cols-3">
          {snapshot.reputations.map((record) => (
            <article
              key={record.agentId}
              className="rounded-xl border border-white/10 bg-zinc-900/60 p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium text-zinc-100">{record.agentId}</p>
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${reputationTone(record.score)}`}
                >
                  {record.score}/100
                </span>
              </div>
              <p className="mt-2 text-xs text-zinc-500">
                {record.successfulActions} successful · {record.violations} violations ·{' '}
                {record.incidents.length} incidents
              </p>
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
              Evidence Chain
            </h2>
          </header>
          <div className="divide-y divide-white/5">
            {snapshot.evidenceChain.map((entry) => (
              <div key={entry.id} className="flex items-start justify-between gap-3 px-5 py-4">
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
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-zinc-950/60">
          <header className="flex items-center gap-2 border-b border-white/10 px-5 py-4">
            <Brain className="h-4 w-4 text-violet-400" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
              Memory Integrity
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
        Trust Hub aggregates Layer A (Tool-Chain + Evidence), Layer B (MCP + Memory), and Layer C
        (Reputation) signals for multi-agent runtime governance.
      </div>
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
