'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  ExternalLink,
  FileCheck2,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  Terminal,
} from 'lucide-react';
import type { IndependentDemoProof } from '@/types/independent-demo-proof';

type SimStep = 'idle' | 'intent' | 'attack' | 'intercept' | 'receipt' | 'done';

const STEP_MS = 900;

function truncateHash(hash: string, head = 12, tail = 8): string {
  if (hash.length <= head + tail + 3) return hash;
  return `${hash.slice(0, head)}…${hash.slice(-tail)}`;
}

export function IndependentVerificationShowcase() {
  const [proof, setProof] = useState<IndependentDemoProof | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [step, setStep] = useState<SimStep>('idle');
  const [running, setRunning] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/demo/independent-verification-proof.json', { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as IndependentDemoProof;
        if (!cancelled) setProof(data);
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : 'Failed to load demo proof bundle');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const lines = useMemo(() => {
    if (!proof) return ['$ nexus demo --await-proof-bundle'];
    const s = proof.scenario;
    const m = proof.mitigation;
    const base = [
      `$ agent run --intent "${s.user_intent}"`,
      `▸ Agent: ${s.agent_id}`,
      `▸ Target: ${s.target}`,
    ];
    const attack = [
      ...base,
      `⚠ MCP tools/call: ${s.proposed_tool}`,
      `  ${JSON.stringify(s.proposed_params)}`,
    ];
    const intercept = [
      ...attack,
      `🛡 Nexus Shield Interceptor — ${proof.runtime_benchmark}`,
      `   DECISION: ${m.decision} (${m.rule_id})`,
      `   Risk: ${m.risk_score} | Violations: ${m.violations.join(', ')}`,
    ];
    const receipt = [
      ...intercept,
      `✓ UAR sealed — SHA-256 ${truncateHash(proof.evidence_bundle_sha256)}`,
      `  receipt_id: ${proof.receipt_id}`,
    ];
    const done = [
      ...receipt,
      '✓ Independent verification URL ready (public /verify — no login).',
    ];
    const byStep = {
      idle: base.slice(0, 1),
      intent: base,
      attack,
      intercept,
      receipt,
      done,
    } satisfies Record<SimStep, string[]>;
    return byStep[step] ?? byStep.idle;
  }, [proof, step]);

  const runLiveProof = useCallback(() => {
    if (!proof || running) return;
    setRunning(true);
    setStep('intent');
    const order: SimStep[] = ['intent', 'attack', 'intercept', 'receipt', 'done'];
    let i = 0;
    const tick = () => {
      i += 1;
      if (i >= order.length) {
        setStep('done');
        setRunning(false);
        return;
      }
      setStep(order[i]!);
      window.setTimeout(tick, STEP_MS);
    };
    window.setTimeout(tick, STEP_MS);
  }, [proof, running]);

  const verifyHref = proof
    ? `/verify?receipt_hash=${encodeURIComponent(proof.evidence_bundle_sha256)}&receipt_id=${encodeURIComponent(proof.receipt_id)}`
    : '/verify';

  return (
    <section
      data-demo="independent-verification-proof"
      className="mx-auto max-w-7xl scroll-mt-24 px-6 py-16"
    >
      <div className="mb-10 max-w-3xl">
        <p className="text-sm font-medium uppercase tracking-wider text-emerald-400/90">
          Bul ve Göster · Detect &amp; Demonstrate
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-white md:text-4xl">
          Live Attack &amp; Independent Verification Proof
        </h1>
        <p className="mt-4 text-lg text-slate-300">
          FinTech agent exfiltration attempts are intercepted at runtime, mitigated with deterministic
          policy, and sealed as a{' '}
          <span className="text-white">Universal Action Receipt (UAR)</span> anyone can check on{' '}
          <Link href="/verify" className="text-emerald-400 underline-offset-4 hover:underline">
            /verify
          </Link>
          .
        </p>
        <p className="mt-3 text-sm text-slate-400">
          Grounded in the{' '}
          <Link
            href="https://www.nexusshield.ai/reports/state-of-agent-security-2026"
            className="text-slate-200 underline-offset-4 hover:text-white hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            State of Agent Security 2026
          </Link>{' '}
          report — same governance story for CISO and CTO review.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/80 shadow-2xl">
          <div className="flex items-center gap-2 border-b border-white/10 bg-zinc-900/80 px-4 py-3 text-xs text-slate-400">
            <Terminal className="h-4 w-4 text-emerald-400" aria-hidden />
            Harness simulation · policy engine
          </div>
          <pre className="max-h-[420px] overflow-auto p-4 font-mono text-xs leading-relaxed text-slate-200">
            {lines.map((line) => (
              <div key={line}>{line}</div>
            ))}
          </pre>
          <div className="flex flex-wrap gap-3 border-t border-white/10 bg-zinc-900/50 p-4">
            <button
              type="button"
              onClick={runLiveProof}
              disabled={!proof || running}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />}
              Run live attack proof
            </button>
            <Link
              href={verifyHref}
              className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white hover:bg-white/10"
            >
              <FileCheck2 className="h-4 w-4" />
              Open independent verify
            </Link>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-6">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-emerald-400" aria-hidden />
              <div>
                <h2 className="text-lg font-semibold text-white">Cryptographic evidence bundle</h2>
                <p className="mt-2 text-sm text-slate-300">
                  Each mitigation emits a UAR with a SHA-256 evidence bundle hash. Stakeholders verify
                  presence and parameters on the public route — independent of vendor dashboards.
                </p>
              </div>
            </div>
            {loadError && (
              <p className="mt-4 rounded-lg border border-rose-500/40 bg-rose-950/30 p-3 text-sm text-rose-200">
                {loadError}. Run{' '}
                <code className="text-rose-100">python scripts/simulate_independent_demo.py --write-public-json</code>{' '}
                from the repo root.
              </p>
            )}
            {proof && (
              <dl className="mt-4 space-y-2 rounded-xl border border-white/10 bg-black/40 p-4 text-xs text-slate-300">
                <div>
                  <dt className="text-slate-500">Decision</dt>
                  <dd className="font-mono text-emerald-300">
                    {proof.mitigation.decision} · {proof.mitigation.rule_id}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Receipt ID</dt>
                  <dd className="break-all font-mono">{proof.receipt_id}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Evidence SHA-256</dt>
                  <dd className="break-all font-mono">{proof.evidence_bundle_sha256}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Generated (UTC)</dt>
                  <dd>{proof.generated_at_utc}</dd>
                </div>
              </dl>
            )}
          </div>

          <div className="rounded-2xl border border-white/10 bg-zinc-900/40 p-6">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">For reviewers</h3>
            <ul className="mt-3 list-inside list-disc space-y-2 text-sm text-slate-300">
              <li>
                Reproduce locally:{' '}
                <code className="rounded bg-black/50 px-1 py-0.5 text-xs">scripts/simulate_independent_demo.py</code>
              </li>
              <li>
                Technical walkthrough:{' '}
                <Link href="https://github.com/baturhantasdelen-sudo/core-ai-firewall/blob/main/docs/DETECT_AND_DEMONSTRATE_PROOF.md" className="text-emerald-400 hover:underline">
                  docs/DETECT_AND_DEMONSTRATE_PROOF.md
                </Link>
              </li>
              <li>
                Report context:{' '}
                <Link
                  href="/reports/state-of-agent-security-2026"
                  className="text-emerald-400 hover:underline"
                >
                  State of Agent Security 2026
                </Link>
              </li>
            </ul>
            {proof?.verification_url && (
              <a
                href={proof.verification_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-white hover:text-emerald-300"
              >
                Deployed verify URL
                <ExternalLink className="h-4 w-4" />
              </a>
            )}
          </div>

          <Link
            href="/#attack-simulator"
            className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"
          >
            Compare with landing Attack Simulator
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
