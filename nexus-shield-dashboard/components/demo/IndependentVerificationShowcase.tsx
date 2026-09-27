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
import type {
  CvePresetsIndex,
  CvePresetIndexEntry,
  IndependentDemoProof,
} from '@/types/independent-demo-proof';

type SimStep = 'idle' | 'intent' | 'attack' | 'intercept' | 'receipt' | 'done';

const STEP_MS = 900;

function truncateHash(hash: string, head = 12, tail = 8): string {
  if (hash.length <= head + tail + 3) return hash;
  return `${hash.slice(0, head)}…${hash.slice(-tail)}`;
}

function severityClass(severity: string | undefined): string {
  switch (severity) {
    case 'critical':
      return 'bg-rose-500/20 text-rose-200 border-rose-500/40';
    case 'high':
      return 'bg-amber-500/20 text-amber-100 border-amber-500/40';
    default:
      return 'bg-slate-500/20 text-slate-200 border-slate-500/40';
  }
}

export function IndependentVerificationShowcase() {
  const [index, setIndex] = useState<CvePresetsIndex | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [proof, setProof] = useState<IndependentDemoProof | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [proofLoading, setProofLoading] = useState(false);
  const [step, setStep] = useState<SimStep>('idle');
  const [running, setRunning] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/demo/cve-presets-index.json', { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as CvePresetsIndex;
        if (!cancelled) {
          setIndex(data);
          setSelectedId(data.default_preset_id);
        }
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : 'Failed to load CVE preset index');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    setProofLoading(true);
    setStep('idle');
    (async () => {
      try {
        const res = await fetch(`/demo/presets/${selectedId}.proof.json`, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as IndependentDemoProof;
        if (!cancelled) {
          setProof(data);
          setLoadError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setProof(null);
          setLoadError(e instanceof Error ? e.message : 'Failed to load preset proof bundle');
        }
      } finally {
        if (!cancelled) setProofLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const selectedMeta: CvePresetIndexEntry | undefined = useMemo(
    () => index?.presets.find((p) => p.preset_id === selectedId),
    [index, selectedId],
  );

  const lines = useMemo(() => {
    if (!proof) return ['$ nexus preset run --await-cve-bundle'];
    const s = proof.scenario;
    const m = proof.mitigation;
    const base = [
      `$ agent run --intent "${s.user_intent}"`,
      `▸ Preset: ${proof.cve_label ?? proof.preset_id}`,
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
          Select an open-source PoC preset from the exploit database, trigger runtime governance, and
          seal a deterministic{' '}
          <span className="text-white">Universal Action Receipt (UAR)</span> verifiable on{' '}
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
          report — modular presets mirror newly disclosed AI agent CVE-style attack chains.
        </p>
      </div>

      <div className="mb-8 rounded-2xl border border-white/10 bg-zinc-900/50 p-4">
        <label htmlFor="cve-preset-select" className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Exploit database preset (PoC)
        </label>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center">
          <select
            id="cve-preset-select"
            value={selectedId ?? ''}
            disabled={!index || proofLoading}
            onChange={(e) => setSelectedId(e.target.value)}
            className="w-full rounded-lg border border-white/15 bg-zinc-950 px-3 py-2.5 text-sm text-white sm:max-w-xl"
          >
            {index?.presets.map((p) => (
              <option key={p.preset_id} value={p.preset_id}>
                {p.cve_label} — {p.title}
              </option>
            ))}
          </select>
          {selectedMeta && (
            <span
              className={`inline-flex shrink-0 items-center rounded-full border px-3 py-1 text-xs font-medium ${severityClass(selectedMeta.severity)}`}
            >
              {selectedMeta.severity} · {selectedMeta.decision}
            </span>
          )}
          {proofLoading && (
            <span className="inline-flex items-center gap-2 text-xs text-slate-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading proof bundle…
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/80 shadow-2xl">
          <div className="flex items-center gap-2 border-b border-white/10 bg-zinc-900/80 px-4 py-3 text-xs text-slate-400">
            <Terminal className="h-4 w-4 text-emerald-400" aria-hidden />
            Harness simulation · policy engine
          </div>
          <pre className="max-h-[420px] overflow-auto p-4 font-mono text-xs leading-relaxed text-slate-200">
            {lines.map((line, i) => (
              <div key={`${i}-${line}`}>{line}</div>
            ))}
          </pre>
          <div className="flex flex-wrap gap-3 border-t border-white/10 bg-zinc-900/50 p-4">
            <button
              type="button"
              onClick={runLiveProof}
              disabled={!proof || running || proofLoading}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />}
              Run Detect &amp; Demonstrate
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
                  Presets use fixed receipt anchors so SHA-256 UAR hashes are reproducible across CLI
                  runs and the public dashboard.
                </p>
              </div>
            </div>
            {loadError && (
              <p className="mt-4 rounded-lg border border-rose-500/40 bg-rose-950/30 p-3 text-sm text-rose-200">
                {loadError}. Run{' '}
                <code className="text-rose-100">
                  python scripts/simulate_vulnerability_preset.py --all --write-public-json
                </code>{' '}
                from the repo root.
              </p>
            )}
            {proof && (
              <dl className="mt-4 space-y-2 rounded-xl border border-white/10 bg-black/40 p-4 text-xs text-slate-300">
                {proof.cve_label && (
                  <div>
                    <dt className="text-slate-500">CVE / PoC label</dt>
                    <dd className="font-mono text-emerald-300">{proof.cve_label}</dd>
                  </div>
                )}
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
                Run a preset:{' '}
                <code className="rounded bg-black/50 px-1 py-0.5 text-xs">
                  python scripts/simulate_vulnerability_preset.py --preset &lt;id&gt;
                </code>
              </li>
              <li>
                Add presets under{' '}
                <code className="rounded bg-black/50 px-1 py-0.5 text-xs">presets/</code> +{' '}
                <code className="rounded bg-black/50 px-1 py-0.5 text-xs">manifest.json</code>
              </li>
              <li>
                Technical walkthrough:{' '}
                <Link
                  href="https://github.com/baturhantasdelen-sudo/core-ai-firewall/blob/main/docs/DETECT_AND_DEMONSTRATE_PROOF.md"
                  className="text-emerald-400 hover:underline"
                >
                  docs/DETECT_AND_DEMONSTRATE_PROOF.md
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
