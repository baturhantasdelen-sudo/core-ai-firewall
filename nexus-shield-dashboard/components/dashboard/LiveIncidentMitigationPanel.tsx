'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Play,
  ShieldAlert,
  ShieldCheck,
  TrendingDown,
} from 'lucide-react';
import type { PitchScenarioResult, PitchStepResult } from '@/lib/engine/demo/pitch-scenario';

interface LiveIncidentMitigationPanelProps {
  apiKey: string;
  autoRun?: boolean;
}

function stepTone(status: PitchStepResult['status']): string {
  switch (status) {
    case 'OK':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
    case 'WARNING':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-300';
    case 'CRITICAL':
      return 'border-rose-500/30 bg-rose-500/10 text-rose-300';
    default:
      return 'border-zinc-500/30 bg-zinc-500/10 text-zinc-300';
  }
}

function DivergenceGauge({ score }: { score: number }) {
  const tone =
    score >= 80 ? 'bg-rose-500' : score >= 50 ? 'bg-amber-500' : 'bg-emerald-500';

  return (
    <div>
      <div className="flex items-center justify-between text-xs text-zinc-500">
        <span>Intent Divergence</span>
        <span className={`font-semibold ${score >= 80 ? 'text-rose-400' : 'text-zinc-300'}`}>
          {score}%
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-800">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${tone}`}
          style={{ width: `${Math.min(100, score)}%` }}
        />
      </div>
    </div>
  );
}

export function LiveIncidentMitigationPanel({ apiKey, autoRun = false }: LiveIncidentMitigationPanelProps) {
  const [running, setRunning] = useState(false);
  const [scenario, setScenario] = useState<PitchScenarioResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [animatedStep, setAnimatedStep] = useState(0);

  const runDemo = useCallback(async () => {
    setRunning(true);
    setError(null);
    setScenario(null);
    setAnimatedStep(0);

    try {
      const response = await fetch('/api/v1/demo/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? 'Demo scenario failed');
      }

      const result = data.scenario as PitchScenarioResult;
      setScenario(result);

      for (let step = 1; step <= result.steps.length; step += 1) {
        await new Promise((resolve) => setTimeout(resolve, 450));
        setAnimatedStep(step);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Demo scenario failed');
    } finally {
      setRunning(false);
    }
  }, [apiKey]);

  useEffect(() => {
    if (autoRun) {
      void runDemo();
    }
  }, [autoRun, runDemo]);

  return (
    <section className="overflow-hidden rounded-2xl border border-rose-500/20 bg-gradient-to-br from-zinc-950/90 via-zinc-900/70 to-rose-950/20 p-5 backdrop-blur-xl sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Activity className="h-4 w-4 shrink-0 text-rose-400" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-rose-200">
              Live Incident Mitigation — Investor Demo
            </h2>
            <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold text-rose-300">
              E2E Pitch
            </span>
          </div>
          <p className="mt-2 max-w-2xl text-sm text-zinc-400">
            Simulates invoice review intent escalating to database export and external upload — with
            real-time SEE → CONTROL → TRUST engine response.
          </p>
        </div>

        <button
          type="button"
          onClick={runDemo}
          disabled={running}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-orange-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-rose-500/20 transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Play className="h-4 w-4" />
          {running ? 'Running Live Demo...' : 'Run Pitch Scenario'}
        </button>
      </div>

      {error ? (
        <p className="mt-4 rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
          {error}
        </p>
      ) : null}

      {scenario ? (
        <div className="mt-6 grid gap-5 lg:grid-cols-5">
          <div className="space-y-3 lg:col-span-3">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Trajectory</p>
            <p className="rounded-lg border border-white/10 bg-zinc-950/60 px-3 py-2 text-sm text-cyan-200">
              Intent: &quot;{scenario.userIntent}&quot;
            </p>

            {scenario.steps.map((step) => (
              <div
                key={step.step}
                className={`rounded-xl border p-4 transition-all duration-500 ${
                  step.step <= animatedStep
                    ? 'border-white/10 bg-zinc-950/70 opacity-100 translate-y-0'
                    : 'border-white/5 bg-zinc-950/30 opacity-40 translate-y-1'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-zinc-500">Step {step.step}</span>
                    <code className="text-sm text-zinc-200">{step.tool}</code>
                  </div>
                  <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${stepTone(step.status)}`}>
                    {step.status}
                  </span>
                </div>
                <p className="mt-2 text-xs text-zinc-500">{step.narrative}</p>
                {step.step <= animatedStep ? (
                  <p className="mt-1 font-mono text-[11px] text-zinc-600">
                    decision={step.decision} · divergence={step.divergenceScore}% · status={step.agentStatus}
                  </p>
                ) : null}
              </div>
            ))}
          </div>

          <div className="space-y-4 rounded-xl border border-white/10 bg-zinc-950/60 p-4 lg:col-span-2">
            <DivergenceGauge score={scenario.finalDivergenceScore} />

            <div className="grid grid-cols-2 gap-3 text-xs">
              <Metric label="Capability Mode" value={scenario.capabilityMode} icon={ShieldAlert} tone="rose" />
              <Metric label="Evidence" value={scenario.evidenceStatus} icon={AlertTriangle} tone="amber" />
              <Metric
                label="Reputation"
                value={`${scenario.reputationBefore} → ${scenario.reputationAfter}`}
                icon={TrendingDown}
                tone="rose"
              />
              <Metric label="Chain Strength" value={`${scenario.evidenceChainStrength}%`} icon={ShieldCheck} tone="cyan" />
            </div>

            <ul className="space-y-2 border-t border-white/10 pt-3">
              {scenario.mitigationSummary.map((line) => (
                <li key={line} className="flex items-start gap-2 text-xs text-zinc-400">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                  {line}
                </li>
              ))}
            </ul>

            <p className="text-[10px] text-zinc-600">
              Engine response in {scenario.durationMs}ms · agent {scenario.agentId}
            </p>
          </div>
        </div>
      ) : (
        <p className="mt-6 text-sm text-zinc-500">
          Click &quot;Run Pitch Scenario&quot; to replay the Acme Corp invoice → export → external upload attack chain.
        </p>
      )}
    </section>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon: typeof ShieldAlert;
  tone: 'rose' | 'amber' | 'cyan';
}) {
  const tones = {
    rose: 'text-rose-300',
    amber: 'text-amber-300',
    cyan: 'text-cyan-300',
  };

  return (
    <div className="rounded-lg border border-white/5 bg-zinc-900/60 p-2.5">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-zinc-600">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <p className={`mt-1 text-xs font-semibold ${tones[tone]}`}>{value}</p>
    </div>
  );
}
