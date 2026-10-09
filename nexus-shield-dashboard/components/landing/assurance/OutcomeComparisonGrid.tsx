'use client';

import { useState } from 'react';

const SCENARIOS = [
  {
    id: 'finance',
    label: 'Finance',
    expected: '$50,000 refund',
    actual: '$500,000 refund',
    status: 'BLOCKED' as const,
  },
  {
    id: 'erp',
    label: 'ERP',
    expected: 'Invoice → PAID',
    actual: 'Invoice → PENDING',
    status: 'UNVERIFIED' as const,
  },
  {
    id: 'crm',
    label: 'CRM',
    expected: 'Customer #182 updated',
    actual: 'Customer #281 modified',
    status: 'FAILED' as const,
  },
  {
    id: 'database',
    label: 'Database',
    expected: '1 record changed',
    actual: '1,842 records changed',
    status: 'BLOCKED' as const,
  },
];

const STATUS_STYLE = {
  VERIFIED: 'text-emerald-400 border-emerald-500/30',
  UNVERIFIED: 'text-amber-300 border-amber-500/30',
  FAILED: 'text-rose-400 border-rose-500/30',
  BLOCKED: 'text-violet-300 border-violet-500/30',
};

export function OutcomeComparisonGrid() {
  const [active, setActive] = useState(0);
  const row = SCENARIOS[active]!;

  return (
    <div>
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-amber-200/80">
        Example scenarios — not live telemetry
      </p>
      <div className="flex flex-wrap gap-2">
        {SCENARIOS.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setActive(i)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
              i === active ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-100' : 'border-white/10 text-zinc-400 hover:border-white/20'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-zinc-900/50 p-4">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500">Expected</p>
          <p className="mt-2 text-sm text-zinc-200">{row.expected}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-zinc-900/50 p-4">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500">Actual (authoritative read)</p>
          <p className="mt-2 text-sm text-zinc-200">{row.actual}</p>
        </div>
      </div>
      <p
        className={`mt-4 inline-flex rounded-full border px-3 py-1 text-xs font-bold ${STATUS_STYLE[row.status]}`}
      >
        {row.status}
      </p>
    </div>
  );
}
