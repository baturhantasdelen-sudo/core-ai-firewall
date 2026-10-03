'use client';

import { useMemo, useState } from 'react';
import { Grid3X3, MinusCircle } from 'lucide-react';
import type { BlastRadiusView } from '@/types/aar-receipt';

export interface BlastRadiusMatrixProps {
  baseline: BlastRadiusView;
  whatIfByTool: Record<string, BlastRadiusView>;
}

function tierTone(tier: string): string {
  switch (tier) {
    case 'CRITICAL':
      return 'text-rose-300';
    case 'HIGH':
      return 'text-orange-300';
    case 'MEDIUM':
      return 'text-amber-300';
    default:
      return 'text-emerald-300';
  }
}

export function BlastRadiusMatrix({ baseline, whatIfByTool }: BlastRadiusMatrixProps) {
  const tools = useMemo(() => Object.keys(baseline.exposure_map).sort(), [baseline.exposure_map]);
  const resources = useMemo(() => {
    const set = new Set<string>();
    for (const list of Object.values(baseline.exposure_map)) {
      for (const r of list) set.add(r);
    }
    return [...set].sort();
  }, [baseline.exposure_map]);

  const [removedTool, setRemovedTool] = useState<string | null>(null);
  const active = removedTool && whatIfByTool[removedTool] ? whatIfByTool[removedTool] : baseline;

  return (
    <div className="rounded-2xl border border-violet-500/20 bg-zinc-950/80 p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <Grid3X3 className="h-5 w-5 text-violet-400" />
        <h3 className="text-lg font-semibold text-zinc-50">Blast Radius &amp; Exposure Matrix</h3>
      </div>
      <p className="mt-2 text-sm text-zinc-400">
        MCP tools mapped to data boundaries — interactive what-if removal recalculates operational risk.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-zinc-500">Risk score</p>
          <p className={`text-3xl font-semibold tabular-nums ${tierTone(active.tier)}`}>{active.score}</p>
          <p className="text-xs text-zinc-500">{active.tier}</p>
        </div>
        <div className="text-xs text-zinc-400">
          <p>{active.tool_count} tools · {active.resource_count} resources</p>
          <p>{active.write_exposures} write exposures</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setRemovedTool(null)}
          className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
            removedTool === null
              ? 'border-violet-500/40 bg-violet-500/15 text-violet-100'
              : 'border-white/10 text-zinc-400'
          }`}
        >
          Baseline
        </button>
        {tools.map((tool) => (
          <button
            key={tool}
            type="button"
            disabled={!whatIfByTool[tool]}
            onClick={() => setRemovedTool(tool)}
            className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-300 hover:border-rose-500/30 disabled:opacity-40"
          >
            <MinusCircle className="h-3.5 w-3.5" />
            Remove {tool}
          </button>
        ))}
      </div>

      <div className="mt-5 overflow-x-auto rounded-xl border border-white/10">
        <table className="min-w-full text-left text-xs">
          <thead className="bg-zinc-900/80 text-zinc-500">
            <tr>
              <th className="px-3 py-2 font-semibold">Tool / Resource</th>
              {resources.map((res) => (
                <th key={res} className="px-3 py-2 font-semibold">
                  {res}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tools
              .filter((t) => removedTool !== t)
              .map((tool) => (
                <tr key={tool} className="border-t border-white/5">
                  <td className="px-3 py-2 font-mono text-violet-200">{tool}</td>
                  {resources.map((res) => {
                    const exposed = active.exposure_map[tool]?.includes(res);
                    return (
                      <td key={res} className="px-3 py-2">
                        <span
                          className={`inline-block rounded px-2 py-0.5 ${
                            exposed
                              ? 'bg-rose-500/20 text-rose-200'
                              : 'bg-zinc-800 text-zinc-600'
                          }`}
                        >
                          {exposed ? 'WRITE' : '—'}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-zinc-500">{active.narrative}</p>
    </div>
  );
}
