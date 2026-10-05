'use client';

import type { DeceptionActionProof } from '@/lib/landing/deception-demo';

const FIELDS: { key: keyof DeceptionActionProof; label: string }[] = [
  { key: 'intentHash', label: 'Intent Hash' },
  { key: 'policyHash', label: 'Policy Hash' },
  { key: 'toolCallHash', label: 'Tool Call Hash' },
  { key: 'transactionId', label: 'Transaction ID' },
  { key: 'resultHash', label: 'Result Hash' },
  { key: 'actionProofHash', label: 'Action Proof' },
];

export function ActionProofBadges({
  proof,
  signature,
}: {
  proof: DeceptionActionProof;
  signature: string;
}) {
  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-2">
        {FIELDS.map(({ key, label }) => (
          <div
            key={key}
            className="rounded-lg border border-white/10 bg-black/40 px-2.5 py-2"
          >
            <p className="text-[9px] font-semibold uppercase tracking-widest text-cyan-400/80">
              {label}
            </p>
            <p className="mt-0.5 break-all font-mono text-[10px] text-zinc-300">{proof[key]}</p>
          </div>
        ))}
      </div>
      <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 px-2.5 py-2">
        <p className="text-[9px] font-semibold uppercase tracking-widest text-emerald-400/90">
          Ed25519 signature
        </p>
        <p className="mt-0.5 break-all font-mono text-[10px] text-emerald-200/90">{signature}</p>
      </div>
    </div>
  );
}
