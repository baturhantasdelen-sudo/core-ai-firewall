'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, FileText, Loader2, ShieldCheck, Terminal, Zap } from 'lucide-react';
import type { DeceptionScenario } from '@/lib/landing/deception-demo';
import { downloadExecutiveReportHtml, downloadUarJson } from '@/lib/landing/deception-export';
import { runDemoVerificationAnimation, type VerifyPhase } from '@/lib/landing/deception-verify';
import { TripartiteOutcomeBanner } from '@/app/components/TripartiteOutcomeBanner';
import { ActionProofBadges } from '@/app/components/ActionProofBadges';

type SandboxPhase = 'idle' | 'running' | 'complete';

export interface InteractiveDeceptionSandboxProps {
  scenario: DeceptionScenario;
}

export function InteractiveDeceptionSandbox({ scenario }: InteractiveDeceptionSandboxProps) {
  const [phase, setPhase] = useState<SandboxPhase>('idle');
  const [lines, setLines] = useState<string[]>([]);
  const [verifyPhase, setVerifyPhase] = useState<VerifyPhase>('idle');
  const [verifyBusy, setVerifyBusy] = useState(false);
  const timeoutsRef = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    for (const id of timeoutsRef.current) window.clearTimeout(id);
    timeoutsRef.current = [];
  }, []);

  useEffect(() => {
    clearTimers();
    setPhase('idle');
    setLines([]);
    setVerifyPhase('idle');
    setVerifyBusy(false);
  }, [scenario.id, clearTimers]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const runTest = useCallback(() => {
    clearTimers();
    setPhase('running');
    setVerifyPhase('idle');
    setLines([`Initializing deception test · ${scenario.pillLabel}…`]);

    const script = scenario.sandboxScript;
    for (const entry of script) {
      const id = window.setTimeout(() => {
        setLines((prev) => [...prev, entry.line]);
      }, entry.delayMs);
      timeoutsRef.current.push(id);
    }

    const doneId = window.setTimeout(() => {
      setPhase('complete');
    }, script[script.length - 1].delayMs + 600);
    timeoutsRef.current.push(doneId);
  }, [clearTimers, scenario]);

  const verifySignature = async () => {
    if (phase !== 'complete' || verifyBusy) return;
    setVerifyBusy(true);
    setVerifyPhase('hashing');
    await runDemoVerificationAnimation(scenario.uarReceipt, setVerifyPhase);
    setVerifyBusy(false);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/70 shadow-2xl shadow-emerald-500/5 backdrop-blur-xl">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-emerald-400" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
            Interactive sandbox · {scenario.pillLabel}
          </span>
        </div>
        <button
          type="button"
          onClick={runTest}
          disabled={phase === 'running'}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-4 py-2 text-xs font-semibold text-zinc-950 shadow-lg shadow-emerald-500/20 transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {phase === 'running' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Zap className="h-3.5 w-3.5" />
          )}
          Run Live Deception Test
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 sm:p-5">
        <TripartiteOutcomeBanner
          activeState={scenario.tripartiteState}
          headline={phase === 'complete' ? scenario.tripartiteHeadline : undefined}
          compact
        />

        <div className="min-h-[180px] flex-1 overflow-y-auto rounded-xl border border-white/10 bg-black/60 p-4 font-mono text-[11px] leading-relaxed text-zinc-300 sm:text-xs">
          {lines.length === 0 ? (
            <p className="text-zinc-600">
              Select a scenario above, then run the live test to walk the accountability pipeline.
            </p>
          ) : (
            lines.map((line, i) => (
              <p
                key={`${i}-${line.slice(0, 24)}`}
                className={
                  line.startsWith('✖')
                    ? 'text-rose-300'
                    : line.startsWith('✓') || line.startsWith('⚡')
                      ? 'text-emerald-300'
                      : ''
                }
              >
                {line}
              </p>
            ))
          )}
          {phase === 'running' ? (
            <span className="mt-2 inline-block h-3 w-1.5 animate-pulse bg-cyan-400" aria-hidden />
          ) : null}
        </div>

        <div className="flex min-h-[160px] flex-col rounded-xl border border-cyan-500/20 bg-zinc-900/50">
          <div className="border-b border-white/10 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-cyan-400/90">
              UAR v2 proof center · action proof factors
            </p>
          </div>
          <div className="flex-1 overflow-auto p-3">
            {phase === 'complete' ? (
              <>
                <ActionProofBadges
                  proof={scenario.uarReceipt.action_proof}
                  signature={scenario.uarReceipt.cryptographic_proof.signature}
                />
                <pre className="mt-3 max-h-40 overflow-auto font-mono text-[10px] leading-relaxed text-emerald-200/80 sm:text-[11px]">
                  {JSON.stringify(scenario.uarReceipt, null, 2)}
                </pre>
              </>
            ) : (
              <p className="font-mono text-[10px] text-zinc-600">
                // Intent + Policy + Tool + Transaction + Result → Action Proof (SHA-256) …
              </p>
            )}
          </div>
        </div>

        {phase === 'complete' ? (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => void verifySignature()}
              disabled={verifyBusy || verifyPhase === 'success'}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2.5 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/15 disabled:opacity-60"
            >
              {verifyBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="h-4 w-4" />
              )}
              Verify Cryptographic Signature (Ed25519 / SHA-256)
            </button>

            {verifyPhase === 'hashing' ? (
              <p className="text-center text-[11px] text-zinc-500">Computing SHA-256 evidence digest…</p>
            ) : null}
            {verifyPhase === 'ed25519' ? (
              <p className="text-center text-[11px] text-zinc-500">Validating Ed25519 verifier signature…</p>
            ) : null}
            {verifyPhase === 'success' ? (
              <p className="rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-3 py-2 text-center text-xs font-semibold text-emerald-200">
                Signature Valid: Tamper-Proof Ledger Confirmed
              </p>
            ) : null}

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => downloadExecutiveReportHtml(scenario)}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/15 bg-zinc-900/80 px-4 py-2 text-xs font-semibold text-zinc-200 transition hover:border-white/25"
              >
                <FileText className="h-3.5 w-3.5" />
                Download Executive PDF Report
              </button>
              <button
                type="button"
                onClick={() =>
                  downloadUarJson(scenario.uarReceipt, `${scenario.uarReceipt.receipt_id}.json`)
                }
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/15"
              >
                <Download className="h-3.5 w-3.5" />
                Export UAR v2 JSON
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
