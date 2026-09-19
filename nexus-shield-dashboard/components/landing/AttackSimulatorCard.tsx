'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Crosshair,
  Fingerprint,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  Zap,
} from 'lucide-react';

const FLOW = [
  { id: 'attack', label: 'Attack', icon: Crosshair, tone: 'text-rose-400 border-rose-500/30 bg-rose-500/10' },
  { id: 'detect', label: 'Detect', icon: ShieldAlert, tone: 'text-amber-400 border-amber-500/30 bg-amber-500/10' },
  { id: 'block', label: 'Block', icon: ShieldCheck, tone: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10' },
  { id: 'evidence', label: 'Evidence Generated', icon: Fingerprint, tone: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' },
] as const;

const ATTACK_PAYLOADS = [
  {
    label: 'Destructive shell',
    command: 'ATTEMPTED DELETE /data/customers — tool: run_command',
    block: 'BLOCKED BY NEXUS SHIELD (5.8ms) — INTENT_MISMATCH',
    proof: 'PROOF GENERATED · SHA-256 a50455955e7f…',
  },
  {
    label: 'PII exfiltration',
    command: 'ATTEMPTED bulk_export_db → external webhook',
    block: 'BLOCKED BY NEXUS SHIELD (6.2ms) — TRAJECTORY_VIOLATION',
    proof: 'PROOF GENERATED · audit_id NS-EV-8842',
  },
  {
    label: 'Payment hijack',
    command: 'ATTEMPTED stripe_transfer $25,000 → attacker_wallet',
    block: 'BLOCKED BY NEXUS SHIELD (4.9ms) — UNSIGNED_ACTION',
    proof: 'PROOF GENERATED · evidence chain sealed',
  },
] as const;

export function AttackSimulatorCard() {
  const [step, setStep] = useState(0);
  const [payloadIndex, setPayloadIndex] = useState(0);
  const [running, setRunning] = useState(false);

  const payload = ATTACK_PAYLOADS[payloadIndex];

  const runSimulation = useCallback(() => {
    setRunning(true);
    setStep(0);
    let current = 0;
    const interval = window.setInterval(() => {
      current += 1;
      setStep(current);
      if (current >= FLOW.length - 1) {
        window.clearInterval(interval);
        setRunning(false);
      }
    }, 900);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    runSimulation();
  }, [payloadIndex, runSimulation]);

  return (
    <section id="attack-simulator" data-demo="attack-simulator" className="scroll-mt-24 mx-auto max-w-7xl px-6 py-16">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-orange-400">
          Interactive Attack Simulator
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
          Attack → Detect → Block → Evidence Generated
        </h2>
        <p className="mt-3 text-sm text-zinc-500 sm:text-base">
          Live preview of how Nexus Shield intercepts agent tool abuse before damage occurs — then seals
          cryptographic proof for audit.
        </p>
      </div>

      <div className="mt-10 overflow-hidden rounded-2xl border border-orange-500/20 bg-gradient-to-br from-zinc-950 via-zinc-900/90 to-orange-950/20 shadow-xl shadow-orange-500/5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-zinc-900/80 px-5 py-4">
          <div className="flex flex-wrap gap-2">
            {ATTACK_PAYLOADS.map((item, index) => (
              <button
                key={item.label}
                type="button"
                disabled={running}
                onClick={() => setPayloadIndex(index)}
                className={`select-none cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                  index === payloadIndex
                    ? 'border-orange-500/40 bg-orange-500/15 text-orange-200'
                    : 'border-white/10 bg-zinc-800/80 text-zinc-400 hover:border-white/20'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              setPayloadIndex((i) => (i + 1) % ATTACK_PAYLOADS.length);
            }}
            disabled={running}
            className="inline-flex select-none cursor-pointer items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-rose-500 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-orange-500/20 transition hover:scale-[1.02] disabled:opacity-60"
          >
            {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Crosshair className="h-3.5 w-3.5" />}
            ATTACK MY AGENT
          </button>
        </div>

        <div className="grid gap-4 p-5 sm:grid-cols-4">
          {FLOW.map((item, index) => {
            const Icon = item.icon;
            const active = index <= step;
            return (
              <div
                key={item.id}
                data-demo={item.id === 'evidence' ? 'attack-evidence-step' : undefined}
                className={`rounded-xl border p-4 transition-all ${
                  active ? item.tone : 'border-white/5 bg-zinc-950/40 text-zinc-600'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Icon className={`h-4 w-4 ${active ? '' : 'opacity-40'}`} />
                  <span className="text-xs font-bold uppercase tracking-wider">{item.label}</span>
                </div>
                {index === 0 && active ? (
                  <p className="mt-2 font-mono text-[11px] leading-relaxed opacity-90">{payload.command}</p>
                ) : null}
                {index === 1 && active ? (
                  <p className="mt-2 font-mono text-[11px] leading-relaxed opacity-90">
                    Runtime scan · risk score 94 · policy TRAJECTORY_FIREWALL
                  </p>
                ) : null}
                {index === 2 && active ? (
                  <p className="mt-2 font-mono text-[11px] leading-relaxed opacity-90">{payload.block}</p>
                ) : null}
                {index === 3 && active ? (
                  <p className="mt-2 font-mono text-[11px] leading-relaxed opacity-90">{payload.proof}</p>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-zinc-950/60 px-5 py-4">
          <div className="inline-flex items-center gap-2 text-xs text-zinc-500">
            <Zap className="h-3.5 w-3.5 text-emerald-400" />
            Sub-10ms Action Firewall · Kill Switch ready
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/scan"
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/15"
            >
              SECURE MY AI AGENT
              <ArrowRight className="h-3 w-3" />
            </Link>
            <Link
              href="/dashboard/simulator?pitch=1"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-zinc-800/80 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-white/20"
            >
              Full red-team console
              <ArrowRight className="h-3 w-3 opacity-60" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
