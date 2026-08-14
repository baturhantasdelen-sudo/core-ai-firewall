'use client';

import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Lock,
  PauseCircle,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Snowflake,
  Unlock,
  X,
} from 'lucide-react';
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

function divergenceGaugeClass(score: number): string {
  if (score >= 80) return 'bg-rose-500';
  if (score >= 60) return 'bg-orange-500';
  if (score >= 35) return 'bg-amber-500';
  return 'bg-emerald-500';
}

function divergenceBadgeClass(score: number): string {
  if (score >= 80) return 'border-rose-500/40 bg-rose-500/15 text-rose-200';
  if (score >= 60) return 'border-orange-500/30 bg-orange-500/10 text-orange-200';
  if (score >= 35) return 'border-amber-500/30 bg-amber-500/10 text-amber-200';
  return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200';
}

interface ActionFirewallPanelProps {
  logs: ActionFirewallLogEntry[];
  summary: {
    total: number;
    allowed: number;
    blocked: number;
    approvalRequired: number;
    frozenAgents: number;
    readOnlyAgents?: number;
  };
}

export function ActionFirewallPanel({ logs, summary }: ActionFirewallPanelProps) {
  const [selectedLog, setSelectedLog] = useState<ActionFirewallLogEntry | null>(null);
  const [managerOpen, setManagerOpen] = useState(false);
  const [managedAgents, setManagedAgents] = useState<Array<{ agentId: string; agentName: string; status: 'FROZEN' | 'READ_ONLY' }>>(() =>
    [...new Map(
      logs
        .filter((log) => log.agentStatus === 'READ_ONLY' || log.agentStatus === 'FROZEN')
        .map((log) => [log.agentId, { agentId: log.agentId, agentName: log.agentName, status: log.agentStatus as 'FROZEN' | 'READ_ONLY' }]),
    ).values()],
  );

  const readOnlyCount = summary.readOnlyAgents ?? logs.filter((l) => l.agentStatus === 'READ_ONLY').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid flex-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <SummaryCard label="Total Evaluations" value={summary.total} icon={ShieldCheck} />
          <SummaryCard label="Allowed" value={summary.allowed} icon={CheckCircle2} tone="emerald" />
          <SummaryCard label="Blocked" value={summary.blocked} icon={ShieldAlert} tone="rose" />
          <SummaryCard label="Human Approval" value={summary.approvalRequired} icon={AlertTriangle} tone="amber" />
          <SummaryCard label="Frozen Agents" value={summary.frozenAgents} icon={PauseCircle} tone="violet" />
          <SummaryCard label="Read-Only Agents" value={readOnlyCount} icon={Lock} tone="orange" />
        </div>
        <button
          type="button"
          onClick={() => setManagerOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl border border-orange-500/30 bg-orange-500/10 px-4 py-2.5 text-sm font-medium text-orange-200 transition hover:border-orange-500/50 hover:bg-orange-500/15"
        >
          <Unlock className="h-4 w-4" />
          Capability Manager
        </button>
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
                <th className="px-5 py-3">Intent Divergence</th>
                <th className="px-5 py-3">Risk</th>
                <th className="px-5 py-3">Agent Status</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr
                  key={log.id}
                  className="cursor-pointer border-t border-white/5 hover:bg-white/[0.02]"
                  onClick={() => setSelectedLog(log)}
                >
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
                  </td>
                  <td className="px-5 py-4">
                    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${decisionStyles(log.decision)}`}>
                      {log.decision}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <DivergenceGauge score={log.intentDivergenceScore} severity={log.divergenceSeverity} />
                  </td>
                  <td className="px-5 py-4 font-mono text-zinc-300">{log.riskScore}</td>
                  <td className="px-5 py-4">
                    <AgentStatusBadge log={log} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {logs
          .filter((log) => log.violations.length > 0 || log.capabilitiesRevoked)
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
              <div className="mt-3">
                <DivergenceGauge score={log.intentDivergenceScore} severity={log.divergenceSeverity} showLabel />
              </div>
              {log.capabilitiesRevoked ? (
                <div className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 py-1.5 text-xs font-medium text-orange-200">
                  <Lock className="h-3.5 w-3.5" />
                  Capabilities Revoked: Demoted to READ_ONLY
                </div>
              ) : null}
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

      {selectedLog ? (
        <LogDetailModal log={selectedLog} onClose={() => setSelectedLog(null)} />
      ) : null}

      {managerOpen ? (
        <CapabilityManagerModal
          agents={managedAgents}
          onClose={() => setManagerOpen(false)}
          onRestore={(agentId) => {
            setManagedAgents((prev) => prev.filter((agent) => agent.agentId !== agentId));
          }}
          onFreeze={(agentId) => {
            setManagedAgents((prev) =>
              prev.map((agent) =>
                agent.agentId === agentId ? { ...agent, status: 'FROZEN' as const } : agent,
              ),
            );
          }}
        />
      ) : null}
    </div>
  );
}

function DivergenceGauge({
  score,
  severity,
  showLabel = false,
}: {
  score: number;
  severity: string;
  showLabel?: boolean;
}) {
  return (
    <div className="min-w-[120px]">
      <div className="flex items-center justify-between gap-2">
        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${divergenceBadgeClass(score)}`}>
          {score}%
        </span>
        {showLabel ? <span className="text-[10px] uppercase text-zinc-500">{severity}</span> : null}
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-zinc-800">
        <div
          className={`h-full rounded-full transition-all ${divergenceGaugeClass(score)}`}
          style={{ width: `${Math.min(100, score)}%` }}
        />
      </div>
    </div>
  );
}

function AgentStatusBadge({ log }: { log: ActionFirewallLogEntry }) {
  if (log.agentStatus === 'FROZEN') {
    return (
      <span className="rounded-full border border-rose-500/40 bg-rose-500/15 px-2.5 py-1 text-[11px] font-semibold text-rose-300">
        FROZEN
      </span>
    );
  }
  if (log.agentStatus === 'READ_ONLY' || log.capabilitiesRevoked) {
    return (
      <span className="rounded-full border border-orange-500/30 bg-orange-500/10 px-2.5 py-1 text-[11px] font-semibold text-orange-200">
        READ_ONLY
      </span>
    );
  }
  return <span className="text-xs text-emerald-400">ACTIVE</span>;
}

function LogDetailModal({ log, onClose }: { log: ActionFirewallLogEntry; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-zinc-950 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-zinc-100">{log.agentName}</h3>
            <p className="text-xs text-zinc-500">{log.toolName}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-zinc-500 hover:bg-white/5 hover:text-zinc-300">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-4 space-y-3 text-sm">
          <p className="text-zinc-400">{log.userIntent}</p>
          <DivergenceGauge score={log.intentDivergenceScore} severity={log.divergenceSeverity} showLabel />
          {log.capabilitiesRevoked ? (
            <p className="rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 py-2 text-xs text-orange-200">
              Capabilities Revoked: Demoted to READ_ONLY
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function CapabilityManagerModal({
  agents,
  onClose,
  onRestore,
  onFreeze,
}: {
  agents: Array<{ agentId: string; agentName: string; status: 'FROZEN' | 'READ_ONLY' }>;
  onClose: () => void;
  onRestore: (agentId: string) => void;
  onFreeze: (agentId: string) => void;
}) {
  const uniqueAgents = useMemo(
    () => [...new Map(agents.map((agent) => [agent.agentId, agent])).values()],
    [agents],
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-zinc-950 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-zinc-100">Capability Manager</h3>
            <p className="mt-1 text-xs text-zinc-500">Restore permissions or fully freeze agents under review</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-zinc-500 hover:bg-white/5 hover:text-zinc-300">
            <X className="h-4 w-4" />
          </button>
        </div>

        {uniqueAgents.length === 0 ? (
          <p className="mt-6 text-sm text-zinc-500">No agents currently in READ_ONLY or FROZEN state.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {uniqueAgents.map((agent) => (
              <li key={agent.agentId} className="rounded-xl border border-white/10 bg-zinc-900/50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-zinc-200">{agent.agentName}</p>
                    <p className="text-xs text-zinc-500">{agent.agentId}</p>
                  </div>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                    agent.status === 'FROZEN'
                      ? 'border-rose-500/40 bg-rose-500/15 text-rose-300'
                      : 'border-orange-500/30 bg-orange-500/10 text-orange-200'
                  }`}>
                    {agent.status}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {agent.status === 'READ_ONLY' ? (
                    <button
                      type="button"
                      onClick={() => onRestore(agent.agentId)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-200 hover:bg-emerald-500/15"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Restore Capabilities
                    </button>
                  ) : null}
                  {agent.status !== 'FROZEN' ? (
                    <button
                      type="button"
                      onClick={() => onFreeze(agent.agentId)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-200 hover:bg-rose-500/15"
                    >
                      <Snowflake className="h-3.5 w-3.5" />
                      Full Freeze
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
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
  tone?: 'zinc' | 'emerald' | 'rose' | 'amber' | 'violet' | 'orange';
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
            : tone === 'orange'
              ? 'text-orange-400'
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
