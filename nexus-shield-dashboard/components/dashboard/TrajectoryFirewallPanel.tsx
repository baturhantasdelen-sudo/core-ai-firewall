'use client';

import { useMemo, useState, useTransition } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  GitBranch,
  Play,
  ShieldAlert,
  ShieldBan,
  ShieldCheck,
  ShieldOff,
  Zap,
} from 'lucide-react';
import {
  evaluateActionFirewall,
  simulateDegradeMode,
  forceRevokeCapabilities,
  resetFirewallState,
  type FirewallDecisionLabel,
} from '@/lib/firewall';
import {
  evaluateTrajectory,
  resetTrajectoryStore,
  type TrajectoryEvaluation,
} from '@/lib/trajectory';

interface InterceptionLog {
  id: string;
  timestamp: string;
  toolName: string;
  decision: FirewallDecisionLabel;
  level: number;
  intercepted: boolean;
  violations: string[];
}

interface TrajectoryFirewallPanelProps {
  defaultAgentId?: string;
  defaultAgentName?: string;
}

function decisionTone(decision: FirewallDecisionLabel): string {
  switch (decision) {
    case 'ALLOW':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200';
    case 'DEGRADE':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-200';
    case 'RESTRICTED':
      return 'border-orange-500/30 bg-orange-500/10 text-orange-200';
    case 'BLOCK':
      return 'border-rose-500/40 bg-rose-500/15 text-rose-200';
  }
}

function riskBarTone(score: number): string {
  if (score >= 0.85) return 'bg-rose-500';
  if (score >= 0.65) return 'bg-orange-500';
  if (score >= 0.4) return 'bg-amber-500';
  return 'bg-emerald-500';
}

export function TrajectoryFirewallPanel({
  defaultAgentId = 'crewai-ops-agent-1',
  defaultAgentName = 'Ops Coordinator',
}: TrajectoryFirewallPanelProps) {
  const [trajectory, setTrajectory] = useState<TrajectoryEvaluation | null>(null);
  const [interceptions, setInterceptions] = useState<InterceptionLog[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const latestDecision = interceptions[0];

  const stats = useMemo(() => {
    const blocked = interceptions.filter((l) => l.decision === 'BLOCK' || l.intercepted).length;
    const degraded = interceptions.filter((l) => l.decision === 'DEGRADE' || l.decision === 'RESTRICTED').length;
    const allowed = interceptions.filter((l) => l.decision === 'ALLOW').length;
    return { blocked, degraded, allowed };
  }, [interceptions]);

  function runExfilDemo() {
    startTransition(() => {
      resetTrajectoryStore(defaultAgentId);
      resetFirewallState(defaultAgentId);

      const stepDefs = [
        { id: 's1', toolName: 'read_invoice', offsetMs: 0 },
        { id: 's2', toolName: 'read_customer_db', offsetMs: 5000 },
        { id: 's3', toolName: 'get_credentials', offsetMs: 12000 },
        { id: 's4', toolName: 'external_api', offsetMs: 18000 },
      ];

      const base = Date.now() - 20_000;
      const logs: InterceptionLog[] = [];
      let evaluation: TrajectoryEvaluation | null = null;

      for (const stepDef of stepDefs) {
        const step = {
          id: stepDef.id,
          toolName: stepDef.toolName,
          timestamp: new Date(base + stepDef.offsetMs).toISOString(),
        };

        evaluation = evaluateTrajectory(defaultAgentId, [step], { agentName: defaultAgentName });

        const fw = evaluateActionFirewall({
          agentId: defaultAgentId,
          agentName: defaultAgentName,
          toolName: step.toolName,
          trajectoryRiskScore: evaluation.risk.score,
          trajectoryViolation: evaluation.risk.sequenceViolationDetected,
          intentDivergenceScore: evaluation.risk.score >= 0.85 ? 88 : 42,
        });

        logs.push({
          id: `int_${step.id}`,
          timestamp: step.timestamp,
          toolName: step.toolName,
          decision: fw.decision,
          level: fw.degradationLevel,
          intercepted: fw.intercepted,
          violations: fw.violations,
        });
      }

      if (evaluation) {
        setTrajectory(evaluation);
        setInterceptions(logs.reverse());
        setStatusMessage(
          evaluation.risk.score >= 0.85
            ? `High trajectory risk detected (${evaluation.risk.score.toFixed(2)}) — adaptive firewall engaged`
            : 'Trajectory evaluated — no critical chain',
        );
      }
    });
  }

  function handleSimulateDegrade() {
    const state = simulateDegradeMode(defaultAgentId);
    setStatusMessage(`Degrade Mode active — LEVEL ${state.level}: ${state.reason}`);
  }

  function handleForceRevoke() {
    const state = forceRevokeCapabilities(defaultAgentId);
    setStatusMessage(`Force Revoke applied — LEVEL ${state.level}, JIT revoked=${state.jitTokensRevoked}`);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-500">
            Trajectory Engine &amp; Adaptive Action Firewall
          </h2>
          <p className="mt-1 text-xs text-zinc-600">
            P0 Sprint 5-6 — 30s action vector analysis · 4-level capability degradation
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={runExfilDemo}
            disabled={isPending}
            className="inline-flex items-center gap-2 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-xs font-medium text-violet-200 transition hover:bg-violet-500/15 disabled:opacity-60"
          >
            <Play className={`h-3.5 w-3.5 ${isPending ? 'animate-pulse' : ''}`} />
            Run Exfil Chain Demo
          </button>
          <button
            type="button"
            onClick={handleSimulateDegrade}
            className="inline-flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-200 transition hover:bg-amber-500/15"
          >
            <ShieldAlert className="h-3.5 w-3.5" />
            Simulate Degrade Mode
          </button>
          <button
            type="button"
            onClick={handleForceRevoke}
            className="inline-flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-200 transition hover:bg-rose-500/15"
          >
            <ShieldOff className="h-3.5 w-3.5" />
            Force Revoke Capabilities
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="ALLOW" value={stats.allowed} icon={ShieldCheck} tone="emerald" />
        <StatCard label="DEGRADE / RESTRICTED" value={stats.degraded} icon={ShieldAlert} tone="amber" />
        <StatCard label="BLOCK / Intercepted" value={stats.blocked} icon={ShieldBan} tone="rose" />
      </div>

      {statusMessage ? (
        <p className="rounded-lg border border-indigo-500/25 bg-indigo-500/10 px-3 py-2 text-xs text-indigo-200">
          {statusMessage}
        </p>
      ) : null}

      {trajectory ? (
        <>
          <div className="rounded-2xl border border-white/10 bg-zinc-900/50 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-violet-400" />
                <p className="text-sm font-medium text-zinc-200">Live Trajectory Chain</p>
              </div>
              <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${decisionTone(
                trajectory.risk.level === 'CRITICAL' ? 'BLOCK' : trajectory.risk.level === 'HIGH' ? 'RESTRICTED' : 'ALLOW',
              )}`}>
                Risk {trajectory.risk.level} · {(trajectory.risk.score * 100).toFixed(0)}%
              </span>
            </div>

            <div className="mt-4 h-2 overflow-hidden rounded-full bg-zinc-800">
              <div
                className={`h-full rounded-full transition-all ${riskBarTone(trajectory.risk.score)}`}
                style={{ width: `${Math.round(trajectory.risk.score * 100)}%` }}
              />
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {trajectory.chain.steps.map((step, index) => (
                <div key={step.id} className="flex items-center gap-2">
                  <span className="rounded-lg border border-cyan-500/25 bg-cyan-500/10 px-2.5 py-1 font-mono text-[10px] text-cyan-200">
                    A_{index + 1}: {step.toolName}
                  </span>
                  {index < trajectory.chain.steps.length - 1 ? (
                    <ArrowRight className="h-3 w-3 text-zinc-600" />
                  ) : null}
                </div>
              ))}
            </div>

            {trajectory.risk.sequenceViolationDetected ? (
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
                <div>
                  <p className="text-xs font-semibold text-rose-200">{trajectory.risk.matchedPattern}</p>
                  <p className="mt-1 text-[11px] text-rose-200/80">{trajectory.risk.reason}</p>
                </div>
              </div>
            ) : null}
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/70">
            <div className="border-b border-white/10 bg-zinc-900/80 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Interception Decisions
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-zinc-500">
                    <th className="px-4 py-3">Time</th>
                    <th className="px-4 py-3">Tool</th>
                    <th className="px-4 py-3">Decision</th>
                    <th className="px-4 py-3">Level</th>
                    <th className="px-4 py-3">Intercepted</th>
                    <th className="px-4 py-3">Violations</th>
                  </tr>
                </thead>
                <tbody>
                  {interceptions.map((log) => (
                    <tr key={log.id} className="border-b border-white/5 hover:bg-zinc-900/40">
                      <td className="px-4 py-3 text-xs text-zinc-500">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-zinc-300">{log.toolName}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${decisionTone(log.decision)}`}>
                          {log.decision}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-400">L{log.level}</td>
                      <td className="px-4 py-3">
                        {log.intercepted ? (
                          <Zap className="h-4 w-4 text-rose-400" />
                        ) : (
                          <ShieldCheck className="h-4 w-4 text-emerald-400" />
                        )}
                      </td>
                      <td className="px-4 py-3 text-[10px] text-zinc-500">
                        {log.violations.join(' · ') || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {latestDecision ? (
            <div className="grid gap-3 sm:grid-cols-4">
              {(['ALLOW', 'DEGRADE', 'RESTRICTED', 'BLOCK'] as FirewallDecisionLabel[]).map((label) => (
                <div
                  key={label}
                  className={`rounded-xl border p-3 text-center text-[10px] font-semibold uppercase tracking-wide ${
                    latestDecision.decision === label
                      ? decisionTone(label)
                      : 'border-white/5 bg-zinc-900/30 text-zinc-600'
                  }`}
                >
                  {label}
                  {latestDecision.decision === label ? ' ← active' : ''}
                </div>
              ))}
            </div>
          ) : null}
        </>
      ) : (
        <p className="rounded-xl border border-dashed border-white/10 bg-zinc-900/30 px-4 py-8 text-center text-sm text-zinc-500">
          Run the exfiltration chain demo to visualize trajectory risk and firewall interception decisions.
        </p>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: typeof ShieldCheck;
  tone: 'emerald' | 'amber' | 'rose';
}) {
  const border =
    tone === 'emerald'
      ? 'border-emerald-500/20'
      : tone === 'amber'
        ? 'border-amber-500/20'
        : 'border-rose-500/20';
  const accent =
    tone === 'emerald' ? 'text-emerald-400' : tone === 'amber' ? 'text-amber-400' : 'text-rose-400';

  return (
    <div className={`rounded-2xl border ${border} bg-zinc-900/60 p-5`}>
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-400">{label}</p>
        <Icon className={`h-4 w-4 ${accent}`} />
      </div>
      <p className="mt-2 text-3xl font-semibold text-zinc-100">{value}</p>
    </div>
  );
}
