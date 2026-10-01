'use client';

import { useState } from 'react';
import { Loader2, ShieldCheck, Zap } from 'lucide-react';
import type { ActionReceiptAPI } from '@/lib/uar/action-receipt-api';
import { buildEvidenceChainPreview } from '@/lib/uar/evidence-chain-stages';

const DEFAULT_INTENT = 'Read-only invoice summary for customer 42';
const DEFAULT_TOOL = 'export_db';

export function ProofCenterUarPlayground() {
  const [intent, setIntent] = useState(DEFAULT_INTENT);
  const [toolName, setToolName] = useState(DEFAULT_TOOL);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<ActionReceiptAPI | null>(null);
  const [chain, setChain] = useState<ReturnType<typeof buildEvidenceChainPreview>>([]);

  async function simulateToolCall() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/uar/inspect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_id: 'playground:agent-01',
          user_intent: intent,
          tool_call: { name: toolName, args: { demo: true } },
        }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as {
        action_receipt: ActionReceiptAPI;
        evaluation?: { decision?: string };
      };
      const r = data.action_receipt;
      setReceipt(r);
      setChain(
        buildEvidenceChainPreview({
          intent,
          toolName,
          decision: data.evaluation?.decision ?? r.authorization,
          beforeHash: r.before_state_hash,
          afterHash: r.after_state_hash,
          evidenceHash: r.evidence_hash,
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Simulation failed');
      setReceipt(null);
      setChain([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section
      id="proof-playground"
      className="scroll-mt-20 rounded-2xl border border-emerald-500/25 bg-gradient-to-b from-emerald-950/30 to-zinc-950/80 p-6 sm:p-8"
    >
      <div className="flex flex-wrap items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-emerald-400" />
        <h2 className="text-lg font-semibold text-zinc-50">Proof Center Playground</h2>
        <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-cyan-200">
          No registration
        </span>
      </div>
      <p className="mt-2 max-w-2xl text-sm text-zinc-400">
        Simulate an agent tool call and inspect a live SHA-256 Universal Action Receipt — before/after
        state hashes and tamper-evident SHA-256 receipt core (hash integrity only).
      </p>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <label className="block text-xs font-medium text-zinc-500">Declared intent</label>
          <textarea
            value={intent}
            onChange={(e) => setIntent(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-white/10 bg-zinc-900/80 px-3 py-2 text-sm text-zinc-100"
          />
          <label className="block text-xs font-medium text-zinc-500">Proposed tool</label>
          <input
            value={toolName}
            onChange={(e) => setToolName(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-zinc-900/80 px-3 py-2 font-mono text-sm text-zinc-100"
          />
          <button
            type="button"
            onClick={() => void simulateToolCall()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-5 py-2.5 text-sm font-semibold text-zinc-950 disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            Simulate Agent Tool Call
          </button>
          {error ? <p className="text-xs text-rose-300">{error}</p> : null}
        </div>

        <div className="rounded-xl border border-white/10 bg-zinc-950/70 p-4 font-mono text-xs">
          {!receipt ? (
            <p className="text-zinc-500">Receipt JSON will appear here after simulation.</p>
          ) : (
            <div className="space-y-3 text-zinc-300">
              <p>
                <span className="text-zinc-500">authorization:</span> {receipt.authorization}{' '}
                <span className="text-zinc-500">policy:</span> {receipt.policy}
              </p>
              <p className="break-all">
                <span className="text-zinc-500">before_state_hash:</span> {receipt.before_state_hash}
              </p>
              <p className="break-all">
                <span className="text-zinc-500">after_state_hash:</span> {receipt.after_state_hash}
              </p>
              <p className="break-all text-emerald-300">
                <span className="text-zinc-500">evidence_hash (SHA-256):</span> {receipt.evidence_hash}
              </p>
              <p className="break-all">
                <span className="text-zinc-500">signature:</span> {receipt.signature}
              </p>
            </div>
          )}
        </div>
      </div>

      {chain.length > 0 ? (
        <div className="mt-6">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
            Evidence chain (hash-linked stages)
          </p>
          <ol className="mt-2 space-y-1.5">
            {chain.map((step, i) => (
              <li
                key={step.stage}
                className="flex flex-wrap items-baseline gap-2 rounded-lg border border-white/5 bg-zinc-900/50 px-3 py-2 text-xs"
              >
                <span className="font-semibold text-cyan-400/90">
                  {i + 1}. {step.stage}
                </span>
                <span className="text-zinc-500">{step.detail}</span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </section>
  );
}
