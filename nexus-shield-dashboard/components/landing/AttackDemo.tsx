'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Download,
  Fingerprint,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  Target,
  UserCheck,
} from 'lucide-react';

const PROOF_HASH = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

const SAMPLE_EVIDENCE_BUNDLE = {
  evidenceId: 'NS-EV-2026-PARAM-HIJACK-001',
  schemaVersion: '1.0',
  generatedAt: new Date().toISOString(),
  agentId: 'finance-agent-v2',
  authority: 'READ_ONLY_FINANCE',
  userIntent: 'Query Balance',
  toolPayload: 'Execute Transfer $10,000 → external_wallet_0x7a3f…',
  verdict: 'BLOCKED',
  blockReason: 'INTENT_MISMATCH · PARAMETER_HIJACKING',
  latencyMs: 3.2,
  sha256: PROOF_HASH,
  signature: 'sig_nexus_shield_ed25519_mock_for_demo_only',
  layers: {
    identity: 'VALIDATED',
    intent: 'MISMATCH_DETECTED',
    action: 'INTERCEPTED',
    proof: 'SEALED',
  },
};

const STEPS = [
  {
    id: 'identity',
    label: 'IDENTITY',
    icon: UserCheck,
    tone: 'text-violet-400 border-violet-500/30 bg-violet-500/10',
    content:
      'Agent ID: finance-agent-v2 | Authority: READ_ONLY_FINANCE (Validated)',
  },
  {
    id: 'intent',
    label: 'INTENT',
    icon: Target,
    tone: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
    content: 'User Intent: Query Balance vs Tool Payload: Execute Transfer (MISMATCH DETECTED)',
  },
  {
    id: 'action',
    label: 'ACTION',
    icon: ShieldAlert,
    tone: 'text-rose-400 border-rose-500/30 bg-rose-500/10',
    content: 'BLOCKED in 3.2ms — Protocol Layer Sidecar Intercepted',
  },
  {
    id: 'proof',
    label: 'PROOF',
    icon: Fingerprint,
    tone: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
    content: `Generated SHA-256 Hash: ${PROOF_HASH.slice(0, 16)}…`,
  },
] as const;

export function AttackDemo() {
  const [step, setStep] = useState(-1);
  const [running, setRunning] = useState(false);

  const runSimulation = useCallback(() => {
    setRunning(true);
    setStep(0);
    let current = 0;
    const interval = window.setInterval(() => {
      current += 1;
      setStep(current);
      if (current >= STEPS.length - 1) {
        window.clearInterval(interval);
        setRunning(false);
      }
    }, 850);
    return () => window.clearInterval(interval);
  }, []);

  const downloadEvidence = useCallback(() => {
    const blob = new Blob([JSON.stringify(SAMPLE_EVIDENCE_BUNDLE, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'nexus-shield-sample-evidence-bundle.json';
    anchor.click();
    URL.revokeObjectURL(url);
  }, []);

  return (
    <section id="attack-simulator" data-demo="attack-demo" className="mx-auto max-w-7xl scroll-mt-24 px-6 py-16">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-orange-400">
          Login-Free Public Demo · Attack My Agent
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
          See Parameter Hijacking Blocked in Real-Time
        </h2>
        <p className="mt-3 text-sm text-zinc-500 sm:text-base">
          No account required — simulate how Nexus Shield intercepts a hijacked tool call before funds
          leave your agent runtime, then seal cryptographic proof for audit.
        </p>
      </div>

      <div className="mt-10 overflow-hidden rounded-2xl border border-orange-500/20 bg-gradient-to-br from-zinc-950 via-zinc-900/90 to-orange-950/20 shadow-xl shadow-orange-500/5">
        <div className="border-b border-white/10 bg-zinc-900/80 px-5 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
            Target Action
          </p>
          <p className="mt-1 font-mono text-sm text-rose-300 sm:text-base">
            Transfer $10,000 to external_wallet_0x7a3f9c2e…
          </p>
          <button
            type="button"
            onClick={runSimulation}
            disabled={running}
            className="mt-4 inline-flex w-full select-none items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-rose-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-500/20 transition hover:scale-[1.01] disabled:opacity-60 sm:w-auto"
          >
            {running ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ShieldAlert className="h-4 w-4" />
            )}
            Simulate Parameter Hijacking Attack
          </button>
        </div>

        <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((item, index) => {
            const Icon = item.icon;
            const active = index <= step;
            return (
              <div
                key={item.id}
                data-demo={item.id === 'proof' ? 'attack-evidence-step' : undefined}
                className={`rounded-xl border p-4 transition-all ${
                  active ? item.tone : 'border-white/5 bg-zinc-950/40 text-zinc-600'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-zinc-500">[{index + 1}]</span>
                  <Icon className={`h-4 w-4 ${active ? '' : 'opacity-40'}`} />
                  <span className="text-xs font-bold uppercase tracking-wider">{item.label}</span>
                </div>
                {active ? (
                  <p className="mt-2 font-mono text-[11px] leading-relaxed opacity-90">{item.content}</p>
                ) : (
                  <p className="mt-2 text-[11px] text-zinc-600">Awaiting simulation…</p>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-zinc-950/60 px-5 py-4">
          <div className="inline-flex items-center gap-2 text-xs text-zinc-500">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            Identity → Intent → Action → Proof · Sub-10ms edge sidecar
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={downloadEvidence}
              className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-500/15"
            >
              <Download className="h-3 w-3" />
              Download Sample Evidence Bundle (JSON)
            </button>
            <Link
              href="/scan"
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/15"
            >
              SECURE MY AI AGENT
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
