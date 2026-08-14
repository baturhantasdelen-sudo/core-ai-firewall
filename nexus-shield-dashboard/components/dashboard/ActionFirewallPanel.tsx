'use client';

import { AlertTriangle, CheckCircle2, PauseCircle, ShieldAlert, ShieldCheck } from 'lucide-react';
import type { ActionDecision } from '@/lib/engine/action-firewall';
import type { ActionFirewallLogEntry } from '@/lib/mock-action-firewall-data';

function decisionStyles(decision: ActionDecision): string {
  switch (decision) {
    case 'ALLOW':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
    case 'BLOCK':
      return 'border-rose-500/30 bg-rose-500/10 text-rose-300';
    default:
      return 'border-amber-500/30 bg-amber-500/10 text-amber-300';
  }
}

interface ActionFirewallPanelProps {
  logs: ActionFirewallLogEntry[];
  summary: {
    total: number;
    allowed: number;
    blocked: number;
    approvalRequired: number;
    frozenAgents: number;
  };
}

export function ActionFirewallPanel({ logs, summary }: ActionFirewallPanelProps) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryCard label="Total Evaluations" value={summary.total} icon={ShieldCheck} />
        <SummaryCard label="Allowed" value={summary.allowed} icon={CheckCircle2} tone="emerald" />
        <SummaryCard label="Blocked" value={summary.blocked} icon={ShieldAlert} tone="rose" />
        <SummaryCard label="Human Approval" value={summary.approvalRequired} icon={AlertTriangle} tone="amber" />
        <SummaryCard label="Frozen Agents" value={summary.frozenAgents} icon={PauseCircle} tone="violet" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/60">
        <div className="border-b border-white/10 px-5 py-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
            Live Action Firewall Logs
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-zinc-900/80 text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-5 py-3">Time</th>
                <th className="px-5 py-3">Agent</th>
                <th className="px-5 py-3">Intent</th>
                <th className="px-5 py-3">Tool Call</th>
                <th className="px-5 py-3">Decision</th>
                <th className="px-5 py-3">Risk</th>
                <th className="px-5 py-3">Intent Match</th>
                <th className="px-5 py-3">Kill Switch</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-t border-white/5 hover:bg-white/[0.02]">
                  <td className="px-5 py-4 font-mono text-xs text-zinc-500">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="px-5 py-4">
                    <div className="font-medium text-zinc-200">{log.agentName}</div>
                    <div className="text-xs text-zinc-500">{log.agentId}</div>
                  </td>
                  <td className="max-w-xs px-5 py-4 text-zinc-300">{log.userIntent}</td>
                  <td className="px-5 py-4">
                    <code className="rounded bg-zinc-900 px-2 py-1 font-mono text-xs text-indigo-300">
                      {log.toolName}
                    </code>
                    <pre className="mt-2 max-w-xs overflow-x-auto text-[11px] text-zinc-500">
                      {JSON.stringify(log.toolArgs)}
                    </pre>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${decisionStyles(log.decision)}`}>
                      {log.decision}
                    </span>
                  </td>
                  <td className="px-5 py-4 font-mono text-zinc-300">{log.riskScore}</td>
                  <td className="px-5 py-4 font-mono text-zinc-300">{log.intentMatchScore}%</td>
                  <td className="px-5 py-4">
                    {log.killSwitchTriggered ? (
                      <span className="rounded-full border border-rose-500/40 bg-rose-500/15 px-2.5 py-1 text-[11px] font-semibold text-rose-300">
                        FROZEN
                      </span>
                    ) : (
                      <span className="text-xs text-zinc-500">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {logs
          .filter((log) => log.violations.length > 0)
          .map((log) => (
            <article
              key={`${log.id}-detail`}
              className="rounded-2xl border border-white/10 bg-zinc-950/70 p-5"
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-medium text-zinc-100">{log.agentName}</h3>
                <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${decisionStyles(log.decision)}`}>
                  {log.decision}
                </span>
              </div>
              <p className="mt-2 text-sm text-zinc-400">{log.userIntent}</p>
              <ul className="mt-3 space-y-2">
                {log.violations.map((violation) => (
                  <li key={violation} className="rounded-lg border border-rose-500/20 bg-rose-500/5 px-3 py-2 text-xs text-rose-200">
                    {violation}
                  </li>
                ))}
              </ul>
            </article>
          ))}
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  tone = 'zinc',
}: {
  label: string;
  value: number;
  icon: typeof ShieldCheck;
  tone?: 'zinc' | 'emerald' | 'rose' | 'amber' | 'violet';
}) {
  const toneClass =
    tone === 'emerald'
      ? 'text-emerald-400'
      : tone === 'rose'
        ? 'text-rose-400'
        : tone === 'amber'
          ? 'text-amber-400'
          : tone === 'violet'
            ? 'text-violet-400'
            : 'text-indigo-400';

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
