'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle2,
  FileJson,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import {
  ACTION_CONTROL_SIMULATOR_SCENARIOS,
  type FlowStepStatus,
  type SimulatorScenario,
  type SimulatorScenarioId,
} from '@/lib/landing/action-control-simulator-data';

const TAB_ACTIVE =
  'border-[#0075de] bg-white text-[#0075de] shadow-none';
const TAB_IDLE =
  'border-[#e3e2de] bg-white/80 text-[#6f6e6b] hover:border-[#c9c8c4] hover:text-[#37352f]';

function statusIcon(status: FlowStepStatus) {
  switch (status) {
    case 'pass':
      return <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />;
    case 'fail':
      return <XCircle className="h-4 w-4 shrink-0 text-amber-700" aria-hidden />;
    case 'warn':
      return <ShieldAlert className="h-4 w-4 shrink-0 text-amber-600" aria-hidden />;
    default:
      return <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#c9c8c4]" aria-hidden />;
  }
}

function statusRowTone(status: FlowStepStatus): string {
  switch (status) {
    case 'pass':
      return 'border-[#e3e2de] bg-[#fbfbfa]';
    case 'fail':
      return 'border-amber-200/80 bg-amber-50/60';
    case 'warn':
      return 'border-amber-100 bg-amber-50/40';
    default:
      return 'border-[#e3e2de] bg-white';
  }
}

function outcomeBadgeClass(tone: SimulatorScenario['outcomeBadge']['tone']): string {
  switch (tone) {
    case 'verified':
      return 'border-emerald-200 bg-emerald-50 text-emerald-800';
    case 'blocked':
      return 'border-amber-200 bg-amber-50 text-amber-900';
    case 'discrepancy':
      return 'border-amber-200 bg-rose-50/80 text-rose-900';
    default:
      return 'border-[#e3e2de] bg-white text-[#37352f]';
  }
}

function ScenarioPanel({ scenario }: { scenario: SimulatorScenario }) {
  return (
    <div
      key={scenario.id}
      className="transition-opacity duration-200 ease-out motion-reduce:transition-none"
      data-scenario={scenario.id}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold tracking-tight text-[#37352f]">{scenario.headline}</h3>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[#6f6e6b]">{scenario.summary}</p>
        </div>
        <span
          className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${outcomeBadgeClass(scenario.outcomeBadge.tone)}`}
        >
          {scenario.outcomeBadge.label}
        </span>
      </div>

      <ol className="mt-6 space-y-2.5" aria-label="Action control flow">
        {scenario.steps.map((step, index) => (
          <li
            key={step.id}
            className={`flex gap-3 rounded-xl border px-4 py-3 transition-colors duration-200 ${statusRowTone(step.status)}`}
          >
            <div className="flex flex-col items-center pt-0.5">
              {statusIcon(step.status)}
              {index < scenario.steps.length - 1 ? (
                <span className="mt-2 hidden w-px flex-1 bg-[#e3e2de] sm:block" aria-hidden />
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-[#37352f]">{step.label}</p>
              <p className="mt-0.5 text-sm text-[#6f6e6b]">{step.detail}</p>
              {step.mono ? (
                <p className="mt-2 overflow-x-auto rounded-lg border border-[#e3e2de] bg-[#f6f5f4] px-2.5 py-1.5 font-mono text-[11px] text-[#52514e]">
                  {step.mono}
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>

      {scenario.receiptPreview ? (
        <div className="mt-5 rounded-xl border border-[#e3e2de] bg-white p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#6f6e6b]">
            <FileJson className="h-3.5 w-3.5 text-[#0075de]" aria-hidden />
            UAR 2.0 receipt preview
          </div>
          <pre className="mt-2 overflow-x-auto font-mono text-[11px] leading-relaxed text-[#37352f]">
            {scenario.receiptPreview}
          </pre>
        </div>
      ) : null}
    </div>
  );
}

export function ActionControlSimulator() {
  const [activeId, setActiveId] = useState<SimulatorScenarioId>('verified');

  const scenario =
    ACTION_CONTROL_SIMULATOR_SCENARIOS.find((s) => s.id === activeId) ??
    ACTION_CONTROL_SIMULATOR_SCENARIOS[0];

  const onTabChange = useCallback((id: SimulatorScenarioId) => {
    setActiveId(id);
  }, []);

  return (
    <section
      id="action-control-simulator"
      data-demo="action-control-simulator"
      className="scroll-mt-24 border-y border-white/5 bg-zinc-950/40 py-16 sm:py-20"
    >
      <div className="mx-auto max-w-4xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#0075de]">
            Action → Outcome → Proof
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
            Interactive action control simulator
          </h2>
          <p className="mt-3 text-sm text-zinc-500 sm:text-base">
            Switch scenarios to see passport checks, circuit breakers, and UAR 2.0 outcome verification — the same
            spine as production governance.
          </p>
        </div>

        <div className="mt-10 overflow-hidden rounded-2xl border border-[#e3e2de]/20 bg-[#f8f7f4] p-1 shadow-none sm:p-1.5">
          <div className="rounded-xl border border-[#e3e2de] bg-[#f6f5f4] px-4 py-3 sm:px-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-medium text-[#37352f]">
                <ShieldCheck className="h-4 w-4 text-[#0075de]" aria-hidden />
                Nexus Shield · governed execution
              </div>
              <Link
                href="/proof-center"
                className="inline-flex items-center gap-1 text-xs font-medium text-[#0075de] transition-opacity duration-200 hover:opacity-80"
              >
                Open Proof Center
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>

          <div className="mt-1 rounded-xl border border-[#e3e2de] bg-white p-4 sm:p-6">
            <div
              role="tablist"
              aria-label="Simulation scenarios"
              className="flex flex-col gap-2 sm:flex-row sm:flex-wrap"
            >
              {ACTION_CONTROL_SIMULATOR_SCENARIOS.map((item) => {
                const selected = item.id === activeId;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    id={`tab-${item.id}`}
                    aria-controls={`panel-${item.id}`}
                    onClick={() => onTabChange(item.id)}
                    className={`cursor-pointer rounded-xl border px-4 py-2.5 text-left text-sm font-medium transition-all duration-200 ease-out ${selected ? TAB_ACTIVE : TAB_IDLE}`}
                  >
                    {item.tabLabel}
                  </button>
                );
              })}
            </div>

            <div
              role="tabpanel"
              id={`panel-${scenario.id}`}
              aria-labelledby={`tab-${scenario.id}`}
              className="mt-6 transition-opacity duration-200 ease-out"
            >
              <ScenarioPanel scenario={scenario} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
