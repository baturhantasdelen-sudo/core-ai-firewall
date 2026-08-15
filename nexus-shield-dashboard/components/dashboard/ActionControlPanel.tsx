'use client';

import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  GitBranch,
  Network,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  XCircle,
} from 'lucide-react';
import type { McpRuntimeDecision } from '@/lib/engine/mcp/mcp-runtime';
import type { TrajectoryRiskLevel } from '@/lib/engine/action-firewall/trajectory-engine';
import type {
  McpRuntimeLogEntry,
  PendingApprovalEntry,
  TrajectoryControlLogEntry,
} from '@/lib/mock-action-control-data';

interface ActionControlPanelProps {
  trajectoryLogs: TrajectoryControlLogEntry[];
  mcpLogs: McpRuntimeLogEntry[];
  pendingApprovals: PendingApprovalEntry[];
  summary: {
    trajectoryViolations: number;
    mcpBlocked: number;
    mcpApprovalRequired: number;
    pendingApprovals: number;
  };
}

function trajectoryRiskTone(level: TrajectoryRiskLevel): string {
  switch (level) {
    case 'CRITICAL':
      return 'border-rose-500/40 bg-rose-500/15 text-rose-200';
    case 'HIGH':
      return 'border-orange-500/30 bg-orange-500/10 text-orange-200';
    case 'MEDIUM':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-200';
    default:
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200';
  }
}

function mcpDecisionTone(decision: McpRuntimeDecision): string {
  switch (decision) {
    case 'ALLOW':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
    case 'BLOCK':
      return 'border-rose-500/30 bg-rose-500/10 text-rose-300';
    case 'ISOLATE':
      return 'border-violet-500/30 bg-violet-500/10 text-violet-300';
    default:
      return 'border-amber-500/30 bg-amber-500/10 text-amber-300';
  }
}

export function ActionControlPanel({
  trajectoryLogs,
  mcpLogs,
  pendingApprovals: initialApprovals,
  summary,
}: ActionControlPanelProps) {
  const [approvals, setApprovals] = useState(initialApprovals);
  const [resolutionLog, setResolutionLog] = useState<string[]>([]);

  const pendingCount = useMemo(
    () => approvals.filter((entry) => entry.status === 'pending').length,
    [approvals],
  );

  function handleApprove(id: string) {
    setApprovals((prev) =>
      prev.map((entry) =>
        entry.id === id ? { ...entry, status: 'approved' as const } : entry,
      ),
    );
    setResolutionLog((prev) => [`Approved request ${id}`, ...prev].slice(0, 5));
  }

  function handleReject(id: string) {
    setApprovals((prev) =>
      prev.map((entry) =>
        entry.id === id ? { ...entry, status: 'rejected' as const } : entry,
      ),
    );
    setResolutionLog((prev) => [`Rejected request ${id}`, ...prev].slice(0, 5));
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ControlSummaryCard
          label="Trajectory Violations"
          value={summary.trajectoryViolations}
          icon={GitBranch}
          tone="rose"
        />
        <ControlSummaryCard
          label="MCP Blocked / Isolated"
          value={summary.mcpBlocked}
          icon={ShieldAlert}
          tone="violet"
        />
        <ControlSummaryCard
          label="MCP Approval Required"
          value={summary.mcpApprovalRequired}
          icon={Network}
          tone="amber"
        />
        <ControlSummaryCard
          label="Pending Human Approval"
          value={pendingCount}
          icon={UserCheck}
          tone="orange"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/60">
        <div className="border-b border-white/10 px-5 py-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
            30-Second Trajectory Sequence Log
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            Chain violations detected when individually safe actions combine into unsafe sequences
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-zinc-900/80 text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-5 py-3">Time</th>
                <th className="px-5 py-3">Agent</th>
                <th className="px-5 py-3">Sequence</th>
                <th className="px-5 py-3">Risk</th>
                <th className="px-5 py-3">Violation</th>
                <th className="px-5 py-3">Reason</th>
              </tr>
            </thead>
            <tbody>
              {trajectoryLogs.map((log) => (
                <tr key={log.id} className="border-t border-white/5">
                  <td className="px-5 py-4 font-mono text-xs text-zinc-500">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="px-5 py-4">
                    <div className="font-medium text-zinc-200">{log.agentName}</div>
                    <div className="text-xs text-zinc-500">{log.agentId}</div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap items-center gap-1">
                      {log.sequence.map((step, index) => (
                        <span key={`${log.id}-${step}-${index}`} className="inline-flex items-center gap-1">
                          <code className="rounded bg-zinc-900 px-1.5 py-0.5 font-mono text-[10px] text-cyan-300">
                            {step}
                          </code>
                          {index < log.sequence.length - 1 ? (
                            <span className="text-zinc-600">→</span>
                          ) : null}
                        </span>
                      ))}
                    </div>
                    {log.matchedPattern ? (
                      <p className="mt-1 text-[10px] text-rose-400">{log.matchedPattern}</p>
                    ) : null}
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${trajectoryRiskTone(log.trajectoryRisk)}`}
                    >
                      {log.trajectoryRisk}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    {log.sequenceViolationDetected ? (
                      <span className="text-xs font-medium text-rose-300">DETECTED</span>
                    ) : (
                      <span className="text-xs text-zinc-500">—</span>
                    )}
                  </td>
                  <td className="max-w-xs px-5 py-4 text-xs text-zinc-400">
                    {log.unsafeSequenceReason || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/60">
        <div className="border-b border-white/10 px-5 py-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
            MCP Runtime Control Decisions
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            IDENTITY · PERMISSIONS · NETWORK · DATA dimension checks at tool invocation time
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-zinc-900/80 text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-5 py-3">Time</th>
                <th className="px-5 py-3">MCP Server</th>
                <th className="px-5 py-3">Tool</th>
                <th className="px-5 py-3">Decision</th>
                <th className="px-5 py-3">Risk</th>
                <th className="px-5 py-3">Violations</th>
              </tr>
            </thead>
            <tbody>
              {mcpLogs.map((log) => (
                <tr key={log.id} className="border-t border-white/5">
                  <td className="px-5 py-4 font-mono text-xs text-zinc-500">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="px-5 py-4 font-mono text-xs text-indigo-300">{log.mcpServerId}</td>
                  <td className="px-5 py-4">
                    <code className="rounded bg-zinc-900 px-2 py-1 font-mono text-xs text-cyan-300">
                      {log.toolName}
                    </code>
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${mcpDecisionTone(log.decision)}`}
                    >
                      {log.decision}
                    </span>
                  </td>
                  <td className="px-5 py-4 font-mono text-zinc-300">{log.riskScore}</td>
                  <td className="max-w-sm px-5 py-4">
                    {log.violations.length > 0 ? (
                      <ul className="space-y-1">
                        {log.violations.map((violation) => (
                          <li key={violation} className="text-xs text-rose-200">
                            {violation}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Clean
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-amber-500/20 bg-amber-500/5">
        <div className="border-b border-amber-500/20 px-5 py-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-200">
            Human Approval Queue
          </h2>
          <p className="mt-1 text-xs text-amber-200/70">
            High-risk actions awaiting operator decision — Approve or Reject
          </p>
        </div>
        {approvals.filter((entry) => entry.status === 'pending').length === 0 ? (
          <p className="px-5 py-8 text-sm text-zinc-500">No pending approval requests.</p>
        ) : (
          <ul className="divide-y divide-white/5">
            {approvals
              .filter((entry) => entry.status === 'pending')
              .map((entry) => (
                <li key={entry.id} className="flex flex-wrap items-start justify-between gap-4 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-zinc-100">{entry.agentName}</p>
                      <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-200">
                        PENDING
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-zinc-400">{entry.userIntent}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <code className="rounded bg-zinc-900 px-2 py-0.5 font-mono text-cyan-300">
                        {entry.toolName}
                      </code>
                      <span className="text-zinc-500">Risk: {entry.riskScore}</span>
                      {entry.mcpServerId ? (
                        <span className="text-zinc-500">MCP: {entry.mcpServerId}</span>
                      ) : null}
                    </div>
                    {entry.trajectoryReason ? (
                      <p className="mt-2 text-xs text-rose-300">{entry.trajectoryReason}</p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => handleApprove(entry.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-200 transition hover:bg-emerald-500/15"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReject(entry.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-200 transition hover:bg-rose-500/15"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      Reject
                    </button>
                  </div>
                </li>
              ))}
          </ul>
        )}
        {resolutionLog.length > 0 ? (
          <div className="border-t border-white/5 px-5 py-3">
            <p className="text-[10px] uppercase tracking-wide text-zinc-500">Recent resolutions</p>
            <ul className="mt-1 space-y-0.5">
              {resolutionLog.map((entry) => (
                <li key={entry} className="text-xs text-zinc-400">
                  {entry}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ControlSummaryCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: typeof ShieldCheck;
  tone: 'rose' | 'amber' | 'violet' | 'orange';
}) {
  const toneClass =
    tone === 'rose'
      ? 'text-rose-400'
      : tone === 'amber'
        ? 'text-amber-400'
        : tone === 'violet'
          ? 'text-violet-400'
          : 'text-orange-400';

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
