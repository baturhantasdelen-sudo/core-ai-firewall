'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Fingerprint, ShieldAlert, Zap } from 'lucide-react';

const STEPS = [
  {
    id: 'attack',
    title: 'Agent Attack Attempt',
    detail: 'Unauthorized shell command: rm -rf / — PII exfiltration via read_customer_records',
    tone: 'text-rose-300 border-rose-500/30 bg-rose-500/10',
    icon: ShieldAlert,
  },
  {
    id: 'intercept',
    title: 'Runtime Intercept',
    detail: 'Nexus Shield blocked in 6.8ms — risk flag INTENT_MISMATCH · trajectory violation',
    tone: 'text-amber-300 border-amber-500/30 bg-amber-500/10',
    icon: Zap,
  },
  {
    id: 'evidence',
    title: 'Cryptographic Evidence',
    detail: 'Action suspended · SHA-256 evidence hash a50455955e7f… immutable audit ledger entry',
    tone: 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10',
    icon: Fingerprint,
  },
] as const;

export function ProveItDemoCard() {
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveStep((current) => (current + 1) % STEPS.length);
    }, 3200);
    return () => window.clearInterval(timer);
  }, []);

  const step = STEPS[activeStep];
  const Icon = step.icon;

  return (
    <article className="rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-zinc-950 via-zinc-900/80 to-cyan-950/30 p-6 shadow-xl shadow-cyan-500/5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-400">
            Prove It — Live Attack → Block → Evidence
          </p>
          <h3 className="mt-2 text-lg font-semibold text-zinc-50">Interactive Verification Demo</h3>
        </div>
        <div className="flex gap-1.5">
          {STEPS.map((item, index) => (
            <button
              key={item.id}
              type="button"
              aria-label={`Show step ${index + 1}`}
              onClick={() => setActiveStep(index)}
              className={`h-2 w-8 rounded-full transition ${
                index === activeStep ? 'bg-cyan-400' : 'bg-zinc-700 hover:bg-zinc-600'
              }`}
            />
          ))}
        </div>
      </div>

      <div className={`mt-5 rounded-xl border p-4 transition-all ${step.tone}`}>
        <div className="flex items-start gap-3">
          <div className="rounded-lg border border-white/10 bg-black/20 p-2">
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold">{step.title}</p>
            <p className="mt-1 font-mono text-xs leading-relaxed opacity-90">{step.detail}</p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {STEPS.map((item, index) => (
          <div
            key={item.id}
            className={`rounded-lg border px-3 py-2 text-[11px] ${
              index === activeStep
                ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-100'
                : 'border-white/5 bg-zinc-950/60 text-zinc-500'
            }`}
          >
            <span className="font-bold">{index + 1}.</span> {item.title}
          </div>
        ))}
      </div>

      <Link
        href="/dashboard/trust-hub"
        className="mt-5 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-cyan-500 to-emerald-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition hover:opacity-90"
      >
        Inspect Full Proof Center Data
        <ArrowRight className="h-4 w-4" />
      </Link>
    </article>
  );
}
