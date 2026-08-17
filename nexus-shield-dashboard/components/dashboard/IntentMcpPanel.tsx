'use client';

import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRightLeft,
  Ban,
  CheckCircle2,
  Radio,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import {
  analyzeIntentDivergence,
  buildMockIntentAnalyses,
  isCriticalDivergence,
  type IntentAnalysisResult,
} from '@/lib/intent';
import {
  buildMockMcpInspectionFeed,
  inspectMcpMessage,
  type McpInspectionResult,
} from '@/lib/mcp';

function divergenceBarTone(percent: number): string {
  if (percent >= 80) return 'bg-rose-500';
  if (percent >= 60) return 'bg-orange-500';
  if (percent >= 35) return 'bg-amber-500';
  return 'bg-emerald-500';
}

function divergenceBadgeTone(percent: number): string {
  if (percent >= 80) return 'border-rose-500/40 bg-rose-500/15 text-rose-200';
  if (percent >= 60) return 'border-orange-500/30 bg-orange-500/10 text-orange-200';
  if (percent >= 35) return 'border-amber-500/30 bg-amber-500/10 text-amber-200';
  return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200';
}

function riskBadgeTone(risk: IntentAnalysisResult['risk']): string {
  switch (risk) {
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

function mcpActionTone(action: McpInspectionResult['action']): string {
  switch (action) {
    case 'ALLOW':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200';
    case 'BLOCK':
      return 'border-rose-500/40 bg-rose-500/15 text-rose-200';
    case 'REQUIRE_APPROVAL':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-200';
  }
}

export function IntentMcpPanel() {
  const analyses = useMemo(() => buildMockIntentAnalyses(), []);
  const mcpFeed = useMemo(() => buildMockMcpInspectionFeed(), []);

  const mcpResults = useMemo(
    () =>
      mcpFeed.map((entry) => ({
        ...entry,
        result: inspectMcpMessage(entry.message, entry.context),
      })),
    [mcpFeed],
  );

  const [selectedAnalysis, setSelectedAnalysis] = useState<IntentAnalysisResult | null>(
    analyses.find((a) => isCriticalDivergence(a)) ?? null,
  );

  const stats = useMemo(() => {
    const critical = analyses.filter((a) => isCriticalDivergence(a)).length;
    const blocked = mcpResults.filter((r) => r.result.action === 'BLOCK').length;
    const allowed = mcpResults.filter((r) => r.result.action === 'ALLOW').length;
    return { critical, blocked, allowed };
  }, [analyses, mcpResults]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-500">
            Intent vs Action Divergence &amp; MCP Runtime Security
          </h2>
          <p className="mt-1 text-xs text-zinc-600">
            P1 Sprint 9-10 — semantic intent drift · live JSON-RPC DPI inspection
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatPill label="Critical Divergence" value={stats.critical} tone="rose" />
          <StatPill label="MCP Blocked" value={stats.blocked} tone="rose" />
          <StatPill label="MCP Allowed" value={stats.allowed} tone="emerald" />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-white/10 bg-zinc-900/50 p-5">
          <div className="mb-4 flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4 text-violet-400" />
            <h3 className="text-sm font-semibold text-zinc-200">Intent → Action Divergence</h3>
          </div>

          <div className="space-y-3">
            {analyses.map((analysis, index) => (
              <button
                key={`${analysis.userIntent}-${index}`}
                type="button"
                onClick={() => setSelectedAnalysis(analysis)}
                className={`w-full rounded-xl border p-4 text-left transition ${
                  selectedAnalysis === analysis
                    ? 'border-violet-500/40 bg-violet-500/10'
                    : 'border-white/10 bg-zinc-950/40 hover:border-white/20'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xs text-zinc-500">Intent</p>
                    <p className="text-sm font-medium text-zinc-200">{analysis.userIntent}</p>
                  </div>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${divergenceBadgeTone(analysis.divergencePercent)}`}
                  >
                    {analysis.divergencePercent}% Divergence
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${riskBadgeTone(analysis.risk)}`}>
                    {analysis.risk}
                  </span>
                  {analysis.recommendation === 'CRITICAL_BLOCK' ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-rose-300">
                      <Ban className="h-3 w-3" />
                      Critical Block
                    </span>
                  ) : null}
                </div>

                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className={`h-full rounded-full ${divergenceBarTone(analysis.divergencePercent)}`}
                    style={{ width: `${Math.min(100, analysis.divergencePercent)}%` }}
                  />
                </div>

                <p className="mt-2 font-mono text-[11px] text-zinc-500">
                  → {analysis.toolCalls.map((t) => t.tool).join(' → ') || 'no tools'}
                </p>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-zinc-900/50 p-5">
          <div className="mb-4 flex items-center gap-2">
            <Radio className="h-4 w-4 text-cyan-400" />
            <h3 className="text-sm font-semibold text-zinc-200">Live MCP JSON-RPC Inspection</h3>
          </div>

          <div className="space-y-3">
            {mcpResults.map((entry, index) => (
              <div
                key={`${entry.label}-${index}`}
                className="rounded-xl border border-white/10 bg-zinc-950/40 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-mono text-xs text-cyan-300/80">{entry.message.method}</p>
                    <p className="mt-0.5 text-[11px] text-zinc-500">{entry.label}</p>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${mcpActionTone(entry.result.action)}`}
                  >
                    {entry.result.action === 'ALLOW' ? (
                      <CheckCircle2 className="h-3 w-3" />
                    ) : entry.result.action === 'BLOCK' ? (
                      <XCircle className="h-3 w-3" />
                    ) : (
                      <ShieldAlert className="h-3 w-3" />
                    )}
                    {entry.result.action}
                  </span>
                </div>

                {entry.result.violations.length > 0 ? (
                  <ul className="mt-3 space-y-1">
                    {entry.result.violations.map((violation) => (
                      <li
                        key={violation}
                        className="flex items-start gap-1.5 text-[11px] text-rose-200/90"
                      >
                        <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                        {violation}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 flex items-center gap-1.5 text-[11px] text-emerald-300/80">
                    <ShieldCheck className="h-3 w-3" />
                    Runtime DPI passed — no violations
                  </p>
                )}

                <p className="mt-2 text-[10px] text-zinc-600">
                  Risk {entry.result.riskScore}/100 · server {entry.context.serverId}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {selectedAnalysis ? (
        <DivergenceDetailCard analysis={selectedAnalysis} onClose={() => setSelectedAnalysis(null)} />
      ) : null}
    </div>
  );
}

function DivergenceDetailCard({
  analysis,
  onClose,
}: {
  analysis: IntentAnalysisResult;
  onClose: () => void;
}) {
  return (
    <div className="rounded-2xl border border-violet-500/25 bg-violet-500/5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-300/70">
            Anomaly Detail
          </p>
          <h4 className="mt-1 text-sm font-semibold text-zinc-100">{analysis.userIntent}</h4>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-white/10 px-2 py-1 text-[10px] text-zinc-400 hover:text-zinc-200"
        >
          Dismiss
        </button>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <Metric label="Divergence" value={`${analysis.divergencePercent}%`} />
        <Metric label="Intent Match" value={`${analysis.intentMatchScore}%`} />
        <Metric label="Recommendation" value={analysis.recommendation.replace('_', ' ')} />
      </div>

      {analysis.mismatchedSteps.length > 0 ? (
        <div className="mt-4 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Semantic Drift
          </p>
          {analysis.mismatchedSteps.map((step) => (
            <div
              key={`${step.tool}-${step.reason}`}
              className="rounded-lg border border-rose-500/20 bg-rose-500/5 px-3 py-2 text-xs text-rose-100/90"
            >
              <span className="font-mono text-rose-300">{step.tool}</span>
              <span className="text-zinc-500"> — </span>
              {step.reason}
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-xs text-emerald-300/80">Intent and tool trajectory are aligned.</p>
      )}

      {analysis.violation ? (
        <p className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 font-mono text-[11px] text-rose-200">
          {analysis.violation}
        </p>
      ) : null}
    </div>
  );
}

function StatPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'rose' | 'emerald';
}) {
  const toneClass =
    tone === 'rose'
      ? 'border-rose-500/30 bg-rose-500/10 text-rose-200'
      : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200';

  return (
    <div className={`rounded-xl border px-3 py-2 ${toneClass}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wider opacity-70">{label}</p>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-zinc-950/50 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-zinc-200">{value}</p>
    </div>
  );
}

/** Run a one-off divergence check — useful for demos and API wiring. */
export function runIntentDivergenceCheck(intent: string, tools: string[]) {
  return analyzeIntentDivergence(
    intent,
    tools.map((tool) => ({ tool })),
  );
}
