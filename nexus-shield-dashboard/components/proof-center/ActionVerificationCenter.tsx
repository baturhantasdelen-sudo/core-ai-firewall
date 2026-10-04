'use client';

import { useEffect, useState } from 'react';
import type { AarReceiptDocument, BlastRadiusView, DelegationTreeView } from '@/types/aar-receipt';
import {
  DEMO_AAR_RECEIPTS,
  DEMO_BLAST_RADIUS,
  DEMO_BLAST_WHAT_IF,
  DEMO_DELEGATION,
} from '@/lib/proof-center/accountability-demo';
import { ReceiptInspector } from '@/components/proof-center/ReceiptInspector';
import { BlastRadiusMatrix } from '@/components/proof-center/BlastRadiusMatrix';
import { DelegationTree } from '@/components/proof-center/DelegationTree';

export function ActionVerificationCenter() {
  const [receipts, setReceipts] = useState<AarReceiptDocument[]>(DEMO_AAR_RECEIPTS);
  const [blast, setBlast] = useState<BlastRadiusView>(DEMO_BLAST_RADIUS);
  const [whatIf, setWhatIf] = useState<Record<string, BlastRadiusView>>(DEMO_BLAST_WHAT_IF);
  const [delegation, setDelegation] = useState<DelegationTreeView>(DEMO_DELEGATION);

  useEffect(() => {
    void (async () => {
      try {
        const [rRes, bRes, dRes] = await Promise.all([
          fetch('/api/v1/accountability/receipts'),
          fetch('/api/v1/accountability/blast-radius'),
          fetch('/api/v1/accountability/delegation'),
        ]);
        if (rRes.ok) {
          const data = (await rRes.json()) as { receipts: AarReceiptDocument[] };
          if (data.receipts?.length) setReceipts(data.receipts);
        }
        if (bRes.ok) {
          const data = (await bRes.json()) as BlastRadiusView & {
            what_if?: Record<string, BlastRadiusView>;
          };
          setBlast(data);
          if (data.what_if) setWhatIf(data.what_if);
        }
        if (dRes.ok) {
          setDelegation((await dRes.json()) as DelegationTreeView);
        }
      } catch {
        /* demo fallback */
      }
    })();
  }, []);

  return (
    <section id="action-verification-center" className="scroll-mt-24 space-y-8">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-400">
          Nexus Shield v2.0
        </p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-50">
          Action Verification Center
        </h2>
        <p className="mt-2 text-sm text-zinc-500">
          Inspect AAR receipts, simulate blast-radius what-if removal, and audit multi-agent delegation chains.
        </p>
      </div>

      <div className="space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-rose-300/90">
          1 — Action Control
        </p>
        <p className="text-sm text-zinc-500">
          Identity, authority, intent, and policy gates before consequential tools execute.
        </p>
      </div>
      <BlastRadiusMatrix baseline={blast} whatIfByTool={whatIf} />

      <div className="space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-300/90">
          2 — Outcome Verification
        </p>
        <p className="text-sm text-zinc-500">
          Cross-check HTTP success against DB, ledger, and ERP state — detect false success (UNVERIFIED).
        </p>
      </div>
      <ReceiptInspector receipts={receipts} />

      <div className="space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-300/90">
          3 — Cryptographic UAR
        </p>
        <p className="text-sm text-zinc-500">
          SHA-256 evidence hashes, Ed25519 seals, and delegation audit trails for every governed attempt.
        </p>
      </div>
      <DelegationTree tree={delegation} />
    </section>
  );
}
