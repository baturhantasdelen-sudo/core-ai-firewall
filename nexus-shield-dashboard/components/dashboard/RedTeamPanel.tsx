'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Crosshair,
  Play,
  Shield,
  ShieldAlert,
  Terminal,
  Wrench,
  XCircle,
} from 'lucide-react';
import {
  RED_TEAM_DEMO_AGENT,
  autoRemediateVulnerabilities,
  buildMockRedTeamSimulation,
  listPredefinedScenarios,
  runRedTeamSimulation,
  type SimulationResult,
  type VectorSimulationOutcome,
} from '@/lib/redteam';

function riskTone(rating: SimulationResult['riskRating']): string {
  switch (rating) {
    case 'EXCELLENT':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200';
    case 'MODERATE':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-200';
    case 'VULNERABLE':
      return 'border-orange-500/30 bg-orange-500/10 text-orange-200';
    default:
      return 'border-rose-500/40 bg-rose-500/15 text-rose-200';
  }
}

function vectorLabel(vector: string): string {
  return vector.replace(/_/g, ' ');
}

export function RedTeamPanel() {
  const [simulation, setSimulation] = useState<SimulationResult | null>(null);
  const [liveFeed, setLiveFeed] = useState<string[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const scenarios = useMemo(() => listPredefinedScenarios(), []);

  useEffect(() => {
    const initial = buildMockRedTeamSimulation();
    setSimulation(initial);
    setLiveFeed([
      `[redteam] Loaded ${scenarios.length} predefined attack scenarios`,
      `[redteam] Baseline resilience=${initial.resilienceScore}/100 (${initial.riskRating})`,
    ]);
  }, [scenarios.length]);

  const appendFeed = useCallback((line: string) => {
    setLiveFeed((prev) => [line, ...prev].slice(0, 12));
  }, []);

  function handleLaunchSimulation() {
    startTransition(() => {
      appendFeed('[redteam] Launching attack simulation...');
      appendFeed(`[redteam] Target: ${RED_TEAM_DEMO_AGENT.agentName} (${RED_TEAM_DEMO_AGENT.agentId})`);

      const result = runRedTeamSimulation(RED_TEAM_DEMO_AGENT);

      for (const outcome of result.outcomes) {
        appendFeed(
          `[redteam] ${outcome.attackVector} → ${outcome.blocked ? 'BLOCKED' : 'EXPOSED'} (risk ${outcome.riskScore})`,
        );
      }

      appendFeed(
        `[redteam] Complete — resilience=${result.resilienceScore}/100 · ${result.blockedCount} blocked · ${result.exposedCount} exposed`,
      );

      setSimulation(result);
      setStatusMessage(
        result.vulnerabilities.length > 0
          ? `${result.vulnerabilities.length} vulnerabilit${result.vulnerabilities.length === 1 ? 'y' : 'ies'} found`
          : 'All attack vectors blocked — agent resilient',
      );
    });
  }

  function handleAutoRemediate() {
    if (!simulation) return;

    startTransition(() => {
      const result = autoRemediateVulnerabilities(simulation.simulationId);
      appendFeed(`[redteam] Auto-remediation applied — ${result.remediated.length} patch(es)`);

      for (const patch of result.remediated) {
        appendFeed(`[redteam] ${patch}`);
      }

      appendFeed(`[redteam] Resilience after remediation: ${result.resilienceScoreAfter}/100`);

      setSimulation((prev) =>
        prev
          ? {
              ...prev,
              resilienceScore: result.resilienceScoreAfter,
              vulnerabilities: result.remainingVulnerabilities,
              remediated: result.remediated,
              riskRating:
                result.resilienceScoreAfter >= 90
                  ? 'EXCELLENT'
                  : result.resilienceScoreAfter >= 70
                    ? 'MODERATE'
                    : result.resilienceScoreAfter >= 40
                      ? 'VULNERABLE'
                      : 'CRITICAL',
            }
          : prev,
      );

      setStatusMessage(`Auto-remediated ${result.remediated.length} vulnerabilit${result.remediated.length === 1 ? 'y' : 'ies'}`);
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-500">
            Continuous Agent Red Teaming
          </h2>
          <p className="mt-1 text-xs text-zinc-600">
            P2 Sprint 15-16 — automated penetration scenarios · resilience scoring · auto-remediation
          </p>
        </div>
        {simulation ? (
          <div className={`rounded-xl border px-4 py-3 ${riskTone(simulation.riskRating)}`}>
            <p className="text-[10px] font-semibold uppercase tracking-wider opacity-70">Resilience Score</p>
            <p className="mt-1 text-2xl font-bold">{simulation.resilienceScore}/100</p>
            <p className="text-[10px] opacity-70">{simulation.riskRating}</p>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleLaunchSimulation}
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/20 disabled:opacity-50"
        >
          <Play className="h-3.5 w-3.5" />
          Launch Attack Simulation
        </button>
        <button
          type="button"
          onClick={handleAutoRemediate}
          disabled={isPending || !simulation?.vulnerabilities.length}
          className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-500/20 disabled:opacity-50"
        >
          <Wrench className="h-3.5 w-3.5" />
          Auto-Remediate Vulnerabilities
        </button>
      </div>

      {statusMessage ? (
        <p className="rounded-lg border border-white/10 bg-zinc-900/60 px-4 py-2 text-xs text-zinc-300">
          {statusMessage}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-white/10 bg-zinc-900/50 p-5">
          <div className="mb-4 flex items-center gap-2">
            <Crosshair className="h-4 w-4 text-rose-400" />
            <h3 className="text-sm font-semibold text-zinc-200">Attack Vector Results</h3>
          </div>

          {simulation ? (
            <div className="space-y-3">
              {simulation.outcomes.map((outcome) => (
                <OutcomeCard key={outcome.scenarioId} outcome={outcome} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-500">No simulation loaded</p>
          )}

          {simulation && simulation.vulnerabilities.length > 0 ? (
            <div className="mt-4 rounded-xl border border-rose-500/25 bg-rose-500/5 p-4">
              <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-rose-300">
                <AlertTriangle className="h-3 w-3" />
                Vulnerabilities Found
              </p>
              <ul className="space-y-1.5">
                {simulation.vulnerabilities.map((vulnerability) => (
                  <li key={vulnerability} className="text-[11px] text-rose-100/90">
                    {vulnerability}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {simulation?.remediated && simulation.remediated.length > 0 ? (
            <div className="mt-4 rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
                Remediated
              </p>
              <ul className="space-y-1">
                {simulation.remediated.map((item) => (
                  <li key={item} className="text-[11px] text-emerald-100/90">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        <section className="rounded-2xl border border-white/10 bg-zinc-900/50 p-5">
          <div className="mb-4 flex items-center gap-2">
            <Terminal className="h-4 w-4 text-cyan-400" />
            <h3 className="text-sm font-semibold text-zinc-200">Simulation Live Feed</h3>
          </div>
          <div className="max-h-80 space-y-1 overflow-y-auto rounded-xl border border-white/5 bg-zinc-950/60 p-3 font-mono text-[11px]">
            {liveFeed.length === 0 ? (
              <p className="text-zinc-600">Awaiting simulation...</p>
            ) : (
              liveFeed.map((line, index) => (
                <p key={`${line}-${index}`} className="text-zinc-400">
                  {line}
                </p>
              ))
            )}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <StatPill
              label="Blocked"
              value={simulation?.blockedCount ?? 0}
              icon={Shield}
              tone="emerald"
            />
            <StatPill
              label="Exposed"
              value={simulation?.exposedCount ?? 0}
              icon={ShieldAlert}
              tone="rose"
            />
          </div>
        </section>
      </div>
    </div>
  );
}

function OutcomeCard({ outcome }: { outcome: VectorSimulationOutcome }) {
  return (
    <div className="rounded-xl border border-white/10 bg-zinc-950/40 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-zinc-200">{vectorLabel(outcome.attackVector)}</p>
          <p className="mt-0.5 font-mono text-[10px] text-zinc-500">{outcome.scenarioId}</p>
        </div>
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
            outcome.blocked
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
              : 'border-rose-500/40 bg-rose-500/15 text-rose-200'
          }`}
        >
          {outcome.blocked ? (
            <>
              <CheckCircle2 className="h-3 w-3" />
              BLOCKED
            </>
          ) : (
            <>
              <XCircle className="h-3 w-3" />
              EXPOSED
            </>
          )}
        </span>
      </div>
      <p className="mt-2 truncate text-[10px] text-zinc-500" title={outcome.response}>
        {outcome.response}
      </p>
    </div>
  );
}

function StatPill({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: typeof Shield;
  tone: 'emerald' | 'rose';
}) {
  const toneClass =
    tone === 'emerald'
      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
      : 'border-rose-500/30 bg-rose-500/10 text-rose-200';

  return (
    <div className={`rounded-xl border px-3 py-2 ${toneClass}`}>
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wider opacity-70">{label}</p>
        <Icon className="h-3.5 w-3.5 opacity-70" />
      </div>
      <p className="mt-1 text-lg font-bold">{value}</p>
    </div>
  );
}
