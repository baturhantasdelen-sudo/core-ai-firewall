'use client';

import type { BillingInterval } from '@/config/pricing';

interface BillingToggleProps {
  interval: BillingInterval;
  onChange: (interval: BillingInterval) => void;
}

export function BillingToggle({ interval, onChange }: BillingToggleProps) {
  const isAnnual = interval === 'year';

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="inline-flex items-center rounded-full border border-white/10 bg-zinc-900/80 p-1">
        <button
          type="button"
          onClick={() => onChange('month')}
          className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
            !isAnnual
              ? 'bg-zinc-100 text-zinc-900 shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Monthly
        </button>
        <button
          type="button"
          onClick={() => onChange('year')}
          className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
            isAnnual
              ? 'bg-zinc-100 text-zinc-900 shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Annual
        </button>
      </div>
      <p
        className={`text-xs font-medium transition-opacity ${
          isAnnual ? 'text-emerald-400 opacity-100' : 'text-zinc-500 opacity-70'
        }`}
      >
        Save 17% with annual billing — Pro from $49/mo
      </p>
    </div>
  );
}
