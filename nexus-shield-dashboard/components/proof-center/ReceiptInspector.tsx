'use client';

import { useMemo, useState } from 'react';
import { Check, Copy, ShieldAlert, ShieldCheck, ShieldX } from 'lucide-react';
import type { AarReceiptDocument, AarVerificationStatus } from '@/types/aar-receipt';
import { filterReceiptsByStatus } from '@/lib/proof-center/accountability-demo';

const STATUS_FILTERS: Array<AarVerificationStatus | 'ALL'> = [
  'ALL',
  'VERIFIED',
  'UNVERIFIED',
  'FAILED',
];

function statusBadgeClass(status: AarVerificationStatus): string {
  switch (status) {
    case 'VERIFIED':
      return 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200';
    case 'UNVERIFIED':
    case 'DISCREPANCY':
      return 'border-rose-500/40 bg-rose-500/15 text-rose-200';
    case 'FAILED':
      return 'border-amber-500/40 bg-amber-500/15 text-amber-200';
    default:
      return 'border-zinc-500/30 bg-zinc-800 text-zinc-300';
  }
}

function statusLabel(status: AarVerificationStatus): string {
  if (status === 'UNVERIFIED') return 'UNVERIFIED / False Success';
  return status;
}

async function copyText(value: string): Promise<void> {
  await navigator.clipboard.writeText(value);
}

export interface ReceiptInspectorProps {
  receipts: AarReceiptDocument[];
}

export function ReceiptInspector({ receipts }: ReceiptInspectorProps) {
  const [filter, setFilter] = useState<AarVerificationStatus | 'ALL'>('ALL');
  const [selectedId, setSelectedId] = useState(receipts[0]?.receipt_id ?? '');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const filtered = useMemo(() => filterReceiptsByStatus(receipts, filter), [receipts, filter]);
  const selected =
    filtered.find((r) => r.receipt_id === selectedId) ?? filtered[0] ?? receipts[0] ?? null;

  async function handleCopy(key: string, text: string) {
    await copyText(text);
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey(null), 1500);
  }

  return (
    <div className="rounded-2xl border border-cyan-500/20 bg-zinc-950/80 p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-cyan-400" />
        <h3 className="text-lg font-semibold text-zinc-50">AAR 2.0 Receipt Inspector</h3>
      </div>
      <p className="mt-2 text-sm text-zinc-400">
        Universal Action Receipts — structural JSON, SHA-256 evidence hash, Ed25519 signature.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setFilter(item)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
              filter === item
                ? 'border-cyan-500/50 bg-cyan-500/15 text-cyan-100'
                : 'border-white/10 bg-zinc-900 text-zinc-400 hover:border-white/20'
            }`}
          >
            {item === 'ALL' ? 'All' : statusLabel(item as AarVerificationStatus)}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {filtered.map((r) => (
          <button
            key={r.receipt_id}
            type="button"
            onClick={() => setSelectedId(r.receipt_id)}
            className={`rounded-lg border px-2.5 py-1 font-mono text-[11px] ${
              selected?.receipt_id === r.receipt_id
                ? 'border-emerald-500/40 text-emerald-200'
                : 'border-white/10 text-zinc-500'
            }`}
          >
            {r.receipt_id}
          </button>
        ))}
      </div>

      {selected ? (
        <div className="mt-5 space-y-4">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${statusBadgeClass(selected.outcome_verification.status)}`}
          >
            {selected.outcome_verification.status === 'VERIFIED' ? (
              <ShieldCheck className="h-3.5 w-3.5" />
            ) : selected.outcome_verification.status === 'FAILED' ? (
              <ShieldAlert className="h-3.5 w-3.5" />
            ) : (
              <ShieldX className="h-3.5 w-3.5" />
            )}
            {statusLabel(selected.outcome_verification.status)}
          </span>

          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { key: 'hash', label: 'evidence_hash', value: selected.cryptographic_proof.evidence_hash },
              { key: 'sig', label: 'Ed25519 signature', value: selected.cryptographic_proof.signature },
            ].map(({ key, label, value }) => (
              <div key={key} className="rounded-xl border border-white/10 bg-zinc-900/70 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
                  <button
                    type="button"
                    aria-label={`Copy ${label}`}
                    onClick={() => void handleCopy(key, value)}
                    className="rounded-md border border-white/10 p-1 text-zinc-400 hover:text-cyan-300"
                  >
                    {copiedKey === key ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
                <p className="mt-1 break-all font-mono text-[11px] text-emerald-300/90">{value}</p>
              </div>
            ))}
          </div>

          <details open className="rounded-xl border border-white/10 bg-black/30 p-3">
            <summary className="cursor-pointer text-xs font-semibold text-zinc-400">Structural JSON</summary>
            <pre className="mt-2 max-h-80 overflow-auto font-mono text-[11px] leading-relaxed text-zinc-300">
              {JSON.stringify(selected, null, 2)}
            </pre>
          </details>
        </div>
      ) : (
        <p className="mt-4 text-sm text-zinc-500">No receipts for this filter.</p>
      )}
    </div>
  );
}
