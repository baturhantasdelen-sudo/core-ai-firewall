'use client';

import { Ghost } from 'lucide-react';
import type { TripartiteState } from '@/lib/landing/tripartite-state';
import { TRIPARTITE_LEGEND, getTripartiteMeta } from '@/lib/landing/tripartite-state';

export function TripartiteOutcomeBanner({
  activeState,
  headline,
  compact,
}: {
  activeState: TripartiteState;
  headline?: string;
  compact?: boolean;
}) {
  const active = getTripartiteMeta(activeState);

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      <div className="flex flex-wrap gap-2">
        {TRIPARTITE_LEGEND.map((item) => {
          const isActive = item.state === activeState;
          return (
            <span
              key={item.state}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wider transition ${
                isActive
                  ? `${item.border} ${item.bg} ${item.text} ${item.glow}`
                  : 'border-white/10 bg-zinc-900/50 text-zinc-500'
              }`}
            >
              {item.ghostAction ? <Ghost className="h-3 w-3" /> : null}
              {item.state}
            </span>
          );
        })}
      </div>
      <p className={`leading-relaxed text-zinc-400 ${compact ? 'text-[11px]' : 'text-xs sm:text-sm'}`}>
        <span className={`font-semibold ${active.text}`}>{active.title}:</span>{' '}
        {headline ?? active.description}
      </p>
    </div>
  );
}
