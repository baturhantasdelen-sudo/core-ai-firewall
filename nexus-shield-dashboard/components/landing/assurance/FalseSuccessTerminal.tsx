'use client';

import { useEffect, useState } from 'react';

const STEPS = [
  { label: 'Agent request', status: 'ok' },
  { label: 'Authorized', status: 'ok' },
  { label: 'Action executed', status: 'ok' },
  { label: 'Payment API → 200 OK', status: 'warn' },
  { label: 'ERP state → PENDING', status: 'warn' },
  { label: 'Nexus Verification Engine', status: 'ok' },
  { label: 'UNVERIFIED — False success detected', status: 'fail' },
] as const;

export function FalseSuccessTerminal() {
  const [index, setIndex] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (reducedMotion) {
      setIndex(STEPS.length - 1);
      return;
    }
    if (index >= STEPS.length - 1) return;
    const t = window.setTimeout(() => setIndex((i) => i + 1), 900);
    return () => window.clearTimeout(t);
  }, [index, reducedMotion]);

  return (
    <div
      className="h-[min(420px,70vh)] w-full overflow-hidden rounded-xl border border-white/10 bg-zinc-950 font-mono text-xs shadow-xl sm:text-sm"
      aria-label="Example simulation: HTTP 200 does not equal business success"
    >
      <div className="flex items-center gap-2 border-b border-white/10 bg-zinc-900/80 px-3 py-2 text-[10px] text-zinc-500">
        <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-amber-200">DEMO</span>
        Outcome verification trace (illustrative)
      </div>
      <ol className="space-y-2 p-4">
        {STEPS.slice(0, index + 1).map((step) => (
          <li key={step.label} className="flex items-start gap-2">
            <span
              className={
                step.status === 'fail'
                  ? 'text-rose-400'
                  : step.status === 'warn'
                    ? 'text-amber-300'
                    : 'text-emerald-400'
              }
              aria-hidden
            >
              {step.status === 'fail' ? '✕' : step.status === 'warn' ? '!' : '✓'}
            </span>
            <span className={step.status === 'fail' ? 'text-rose-200' : 'text-zinc-300'}>{step.label}</span>
          </li>
        ))}
      </ol>
      <p className="border-t border-white/5 px-4 py-3 text-[10px] text-zinc-500">
        HTTP 200 ≠ business success. Authoritative ERP/ledger reads drive verification status.
      </p>
    </div>
  );
}
