'use client';

import { useEffect, useState } from 'react';
import {
  Activity,
  Ban,
  Gauge,
  Package,
  Radar,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import {
  INVESTOR_GROWTH_METRICS,
  formatGrowthNumber,
  generateLiveEvent,
  type LiveGrowthEvent,
} from '@/lib/investor-growth-metrics';

const METRIC_CARDS = [
  {
    key: 'scannedAgentsMcps' as const,
    label: 'Scanned Agents & MCPs',
    icon: Radar,
    accent: 'text-cyan-400',
  },
  {
    key: 'developersInstalled' as const,
    label: 'Developers Installed',
    sub: 'npm · pip · docker',
    icon: Package,
    accent: 'text-violet-400',
  },
  {
    key: 'analyzedToolCalls' as const,
    label: 'Analyzed Tool Calls',
    icon: Activity,
    accent: 'text-emerald-400',
  },
  {
    key: 'blockedDangerousActions' as const,
    label: 'Blocked Dangerous Actions',
    icon: Ban,
    accent: 'text-rose-400',
  },
];

function severityClass(severity: LiveGrowthEvent['severity']): string {
  if (severity === 'block') return 'text-rose-300 border-rose-500/20 bg-rose-500/5';
  if (severity === 'proof') return 'text-emerald-300 border-emerald-500/20 bg-emerald-500/5';
  return 'text-zinc-400 border-white/5 bg-zinc-900/40';
}

export function InvestorGrowthDashboard() {
  const [events, setEvents] = useState<LiveGrowthEvent[]>([]);
  const metrics = INVESTOR_GROWTH_METRICS;

  useEffect(() => {
    let index = 0;
    const seed = Array.from({ length: 6 }, (_, i) => generateLiveEvent(i));
    setEvents(seed);

    const timer = setInterval(() => {
      index += 1;
      setEvents((prev) => [generateLiveEvent(index), ...prev].slice(0, 12));
    }, 2800);

    return () => clearInterval(timer);
  }, []);

  return (
    <div data-demo="investor-growth-dashboard" className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {METRIC_CARDS.map(({ key, label, sub, icon: Icon, accent }) => (
          <div
            key={key}
            className="rounded-2xl border border-white/10 bg-zinc-900/60 p-5 backdrop-blur-sm"
          >
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              <Icon className={`h-4 w-4 ${accent}`} />
              {label}
            </div>
            <p className="mt-3 text-3xl font-bold tabular-nums text-zinc-50">
              {formatGrowthNumber(metrics[key])}
            </p>
            {sub ? <p className="mt-1 text-xs text-zinc-600">{sub}</p> : null}
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
            <Gauge className="h-4 w-4 text-cyan-400" />
            Average Intercept Latency
          </div>
          <p className="mt-4 font-mono text-4xl font-bold text-zinc-50">
            {metrics.avgInterceptLatencyMs.toFixed(2)}{' '}
            <span className="text-lg font-normal text-zinc-500">ms</span>
          </p>
          {metrics.certifiedSub10ms ? (
            <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
              <Zap className="h-3.5 w-3.5" />
              P99 6.1ms (harness)
            </span>
          ) : null}
        </div>

        <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
            <ShieldCheck className="h-4 w-4 text-violet-400" />
            Detection Success Rate
          </div>
          <p className="mt-4 font-mono text-4xl font-bold text-zinc-50">
            {metrics.detectionSuccessRatePct}%
          </p>
          <p className="mt-2 text-xs text-zinc-500">
            Rolling 30-day fleet average across intent, trajectory, and MCP guardrails.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/40 p-5">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm font-semibold text-zinc-200">Live Event Ticker</p>
          <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
            Simulated Real-Time
          </span>
        </div>
        <ul className="mt-4 max-h-72 space-y-2 overflow-y-auto font-mono text-xs">
          {events.map((evt) => (
            <li
              key={evt.id}
              className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 ${severityClass(evt.severity)}`}
            >
              <span>{evt.message}</span>
              {evt.latencyMs > 0 ? (
                <span className="shrink-0 tabular-nums opacity-80">{evt.latencyMs}ms</span>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
