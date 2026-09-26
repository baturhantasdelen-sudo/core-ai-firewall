'use client';

import { Fragment, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Filter,
  Gauge,
  Search,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { NEXUS_RUNTIME_LATENCY_METRIC } from '@/lib/brand/copy-standards';
import { SCORECARD_2026 } from '@/lib/scorecard/scorecard-data';
import type { ScorecardFrameworkRow, ScorecardVectorId } from '@/types/scorecard-2026';

function OotbBadge({ status }: { status: 'FAIL' | 'PARTIAL' }) {
  if (status === 'PARTIAL') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/35 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-200">
        <AlertTriangle className="h-3 w-3" />
        Partial
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/35 bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-200">
      <XCircle className="h-3 w-3" />
      Fail
    </span>
  );
}

function ShieldBadge({ latencyMs }: { latencyMs: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/35 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-200">
      <CheckCircle2 className="h-3 w-3" />
      Pass · {latencyMs.toFixed(1)}ms
    </span>
  );
}

function FrameworkDetail({ row }: { row: ScorecardFrameworkRow }) {
  return (
    <div className="space-y-3 border-t border-white/5 bg-zinc-950/40 px-4 py-4">
      {row.cells.map((c) => (
        <div
          key={c.vector_id}
          className="grid gap-3 rounded-xl border border-white/8 bg-zinc-900/50 p-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Vector</p>
            <p className="mt-1 text-sm font-medium text-zinc-200">{c.vector_name}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Insecure default
            </p>
            <p className="mt-1 tabular-nums text-sm text-rose-300">{c.ootb_defense_rate_pct}% defended</p>
            <div className="mt-1.5">
              <OotbBadge status={c.ootb_status} />
            </div>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Nexus Shield
            </p>
            <p className="mt-1 tabular-nums text-sm text-emerald-300">
              {c.nexus_shield_mitigation_pct}% mitigated
            </p>
            <div className="mt-1.5">
              <ShieldBadge latencyMs={c.intercept_latency_ms} />
            </div>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Divergence · Revocation · Evidence
            </p>
            <p className="mt-1 font-mono text-xs text-zinc-400">
              Δ {c.intent_divergence_ootb.toFixed(2)} → {c.intent_divergence_with_shield.toFixed(2)}
            </p>
            <p className="mt-1 text-xs text-cyan-300/90">{c.capability_revocation}</p>
            <p className="mt-1 truncate font-mono text-[10px] text-zinc-500" title={c.evidence_id}>
              {c.evidence_id}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ScorecardMatrix() {
  const [query, setQuery] = useState('');
  const [vectorFilter, setVectorFilter] = useState<ScorecardVectorId | 'all'>('all');
  const [expanded, setExpanded] = useState<string | null>(SCORECARD_2026.frameworks[0]?.slug ?? null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return SCORECARD_2026.frameworks.filter((row) => {
      if (!q) return true;
      return row.framework.toLowerCase().includes(q) || row.slug.includes(q);
    });
  }, [query]);

  const vectorLabel =
    vectorFilter === 'all'
      ? 'All attack vectors'
      : SCORECARD_2026.vectors.find((v) => v.id === vectorFilter)?.name ?? vectorFilter;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            type="search"
            placeholder="Filter frameworks…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-zinc-900/60 py-2.5 pl-10 pr-4 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-cyan-500/40 focus:outline-none focus:ring-1 focus:ring-cyan-500/30"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-zinc-500" />
          <select
            value={vectorFilter}
            onChange={(e) => setVectorFilter(e.target.value as ScorecardVectorId | 'all')}
            className="rounded-xl border border-white/10 bg-zinc-900/60 px-3 py-2.5 text-sm text-zinc-200 focus:border-cyan-500/40 focus:outline-none"
            aria-label="Attack vector filter"
          >
            <option value="all">All attack vectors</option>
            {SCORECARD_2026.vectors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="text-xs text-zinc-500">
        Showing {filtered.length} frameworks · lens: <span className="text-zinc-400">{vectorLabel}</span>
      </p>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/40 backdrop-blur-md">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-zinc-950/50 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                <th className="px-4 py-3">Framework</th>
                <th className="px-4 py-3">Out-of-the-box</th>
                <th className="px-4 py-3">With Nexus Shield</th>
                <th className="px-4 py-3">Divergence (OOTB)</th>
                <th className="px-4 py-3">Capability</th>
                <th className="px-4 py-3">Evidence</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const cell =
                  vectorFilter === 'all'
                    ? null
                    : row.cells.find((c) => c.vector_id === vectorFilter);
                const ootbPct = cell?.ootb_defense_rate_pct ?? row.ootb_defense_avg_pct;
                const shieldPct = cell?.nexus_shield_mitigation_pct ?? row.nexus_shield_mitigation_avg_pct;
                const lat = cell?.intercept_latency_ms ?? row.nexus_shield_latency_p50_ms;
                const divOotb = cell?.intent_divergence_ootb ?? row.cells[0]?.intent_divergence_ootb ?? 0;
                const evidence = cell?.evidence_id ?? `MCP-SEC-SCORE-${row.slug}-aggregate`;
                const isOpen = expanded === row.slug;

                return (
                  <Fragment key={row.slug}>
                    <tr
                      className="cursor-pointer border-b border-white/5 transition hover:bg-zinc-900/60"
                      onClick={() => setExpanded(isOpen ? null : row.slug)}
                    >
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <ChevronDown
                            className={`h-4 w-4 text-zinc-500 transition ${isOpen ? 'rotate-0' : '-rotate-90'}`}
                          />
                          <span className="font-medium text-zinc-100">{row.framework}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-col gap-1">
                          <span className="tabular-nums text-rose-300">{ootbPct.toFixed(1)}% defended</span>
                          <OotbBadge status={ootbPct >= 22 ? 'PARTIAL' : 'FAIL'} />
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-col gap-1">
                          <span className="tabular-nums text-emerald-300">{shieldPct.toFixed(1)}% mitigated</span>
                          <ShieldBadge latencyMs={lat} />
                        </div>
                      </td>
                      <td className="px-4 py-4 font-mono text-xs text-amber-200/90">{divOotb.toFixed(2)}</td>
                      <td className="px-4 py-4 text-xs font-medium text-cyan-300">READ_ONLY</td>
                      <td className="max-w-[140px] truncate px-4 py-4 font-mono text-[10px] text-zinc-500" title={evidence}>
                        {evidence}
                      </td>
                    </tr>
                    {isOpen ? (
                      <tr>
                        <td colSpan={6} className="p-0">
                          <FrameworkDetail row={row} />
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          {
            icon: Gauge,
            label: 'OOTB defense (avg)',
            value: `${SCORECARD_2026.headline_stats.ootb_defense_rate_avg_pct}%`,
            sub: `${SCORECARD_2026.headline_stats.ootb_defense_rate_range_pct[0]}–${SCORECARD_2026.headline_stats.ootb_defense_rate_range_pct[1]}% range`,
          },
          {
            icon: ShieldCheck,
            label: 'Nexus Shield mitigation',
            value: `${SCORECARD_2026.headline_stats.nexus_shield_mitigation_avg_pct}%`,
            sub: NEXUS_RUNTIME_LATENCY_METRIC,
          },
          {
            icon: CheckCircle2,
            label: 'Evidence standard',
            value: 'MCP-SEC-SCORE',
            sub: 'Per-vector cryptographic bundles',
          },
        ].map(({ icon: Icon, label, value, sub }) => (
          <div
            key={label}
            className="rounded-2xl border border-white/10 bg-zinc-900/50 p-5 backdrop-blur-sm"
          >
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              <Icon className="h-4 w-4 text-emerald-400" />
              {label}
            </div>
            <p className="mt-3 text-2xl font-bold tabular-nums text-zinc-50">{value}</p>
            <p className="mt-2 text-xs text-zinc-500">{sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
