'use client';

import { Globe2, Radar, ShieldCheck, Skull } from 'lucide-react';
import type { BehavioralThreatSignature } from '@/lib/engine/immune';

interface ThreatIntelPanelProps {
  signatures: BehavioralThreatSignature[];
  stats: {
    status: string;
    totalSignatures: number;
    criticalSignatures: number;
    categories: Record<string, number>;
  };
}

const categoryLabels: Record<string, string> = {
  GOAL_HIJACK: 'Goal Hijack',
  PRIVILEGE_ESCALATION: 'Privilege Escalation',
  TOOL_MISUSE: 'Tool Misuse',
  DATA_EXFILTRATION: 'Data Exfiltration',
};

export function ThreatIntelPanel({ signatures, stats }: ThreatIntelPanelProps) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Immune Network Status"
          value={stats.status}
          icon={ShieldCheck}
          tone="emerald"
          isText
        />
        <MetricCard label="Active Signatures" value={String(stats.totalSignatures)} icon={Radar} />
        <MetricCard
          label="Critical Signatures"
          value={String(stats.criticalSignatures)}
          icon={Skull}
          tone="rose"
        />
        <MetricCard
          label="Global Nodes Protected"
          value="Collective"
          icon={Globe2}
          tone="indigo"
          isText
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Object.entries(stats.categories).map(([category, count]) => (
          <div
            key={category}
            className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4"
          >
            <p className="text-xs uppercase tracking-wide text-zinc-500">
              {categoryLabels[category] ?? category}
            </p>
            <p className="mt-2 text-2xl font-semibold text-zinc-100">{count}</p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/60">
        <div className="border-b border-white/10 px-5 py-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
            Collective Threat Signatures
          </h2>
        </div>
        <div className="divide-y divide-white/5">
          {signatures.map((signature) => (
            <article key={signature.id} className="px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-indigo-300">
                      #{signature.id}
                    </span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                        signature.severity === 'CRITICAL'
                          ? 'border-rose-500/40 bg-rose-500/15 text-rose-300'
                          : 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                      }`}
                    >
                      {signature.severity}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-zinc-300">
                    {categoryLabels[signature.category] ?? signature.category}
                  </p>
                  <p className="mt-1 font-mono text-[11px] text-zinc-500">
                    hash:{signature.signatureHash.slice(0, 16)}…
                  </p>
                </div>
                <span className="text-xs text-zinc-500">
                  {new Date(signature.createdAt).toLocaleString()}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {signature.pattern.map((token) => (
                  <span
                    key={`${signature.id}-${token}`}
                    className="rounded-md border border-white/10 bg-zinc-900 px-2 py-1 font-mono text-[11px] text-zinc-300"
                  >
                    {token}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
  tone = 'zinc',
  isText = false,
}: {
  label: string;
  value: string;
  icon: typeof ShieldCheck;
  tone?: 'zinc' | 'emerald' | 'rose' | 'indigo';
  isText?: boolean;
}) {
  const toneClass =
    tone === 'emerald'
      ? 'text-emerald-400'
      : tone === 'rose'
        ? 'text-rose-400'
        : tone === 'indigo'
          ? 'text-indigo-400'
          : 'text-violet-400';

  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-400">{label}</p>
        <Icon className={`h-4 w-4 ${toneClass}`} />
      </div>
      <p className={`mt-2 font-semibold text-zinc-100 ${isText ? 'text-base' : 'text-3xl'}`}>
        {value}
      </p>
    </div>
  );
}
