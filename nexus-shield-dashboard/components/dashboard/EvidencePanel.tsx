'use client';

import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Fingerprint,
  GitBranch,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  X,
} from 'lucide-react';
import {
  buildMockEvidenceBundles,
  generateMerkleProof,
  getOrBuildEvidenceMerkleTree,
  verifyEvidenceBundle,
  verifyEvidenceProof,
  type EvidenceBundle,
  type MerkleProof,
} from '@/lib/evidence';

export function EvidencePanel() {
  const bundles = useMemo(() => buildMockEvidenceBundles(), []);
  const tree = useMemo(() => getOrBuildEvidenceMerkleTree(bundles), [bundles]);

  const verified = bundles.filter((b) => b.status === 'VERIFIED');
  const unverified = bundles.filter((b) => b.status !== 'VERIFIED');

  const [selectedBundle, setSelectedBundle] = useState<EvidenceBundle | null>(null);
  const [proofResult, setProofResult] = useState<{
    valid: boolean;
    reason: string;
    proof: MerkleProof | null;
  } | null>(null);

  function handleVerifyProof(bundle: EvidenceBundle) {
    const proof = generateMerkleProof(tree, bundle);
    const verification = verifyEvidenceBundle(bundle, tree);
    const merkleValid = proof ? verifyEvidenceProof(proof) : false;

    setSelectedBundle(bundle);
    setProofResult({
      valid: verification.valid && merkleValid,
      reason: verification.reason,
      proof,
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-500">
            Evidence Engine &amp; Merkle Verification
          </h2>
          <p className="mt-1 text-xs text-zinc-600">
            P1 Sprint 7-8 — SHA-256 signed bundles · immutable Merkle chain
          </p>
        </div>
        <div className="rounded-xl border border-cyan-500/25 bg-cyan-500/10 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-cyan-300/80">Merkle Root</p>
          <p className="mt-1 max-w-xs truncate font-mono text-[11px] text-cyan-200" title={tree.rootHash}>
            {tree.rootHash}
          </p>
          <p className="mt-1 text-[10px] text-cyan-300/60">{tree.leafCount} bundles · {tree.builtAt.slice(0, 19)}</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label="Verified Actions" value={verified.length} icon={ShieldCheck} tone="emerald" />
        <StatCard label="Unverified Actions" value={unverified.length} icon={ShieldX} tone="rose" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <EvidenceSection
          title="VERIFIED ACTION"
          subtitle="Cryptographic proof complete"
          bundles={verified}
          tone="verified"
          onVerify={handleVerifyProof}
        />
        <EvidenceSection
          title="UNVERIFIED ACTION"
          subtitle="Missing proof — manual review pending"
          bundles={unverified}
          tone="unverified"
          onVerify={handleVerifyProof}
        />
      </div>

      {selectedBundle && proofResult ? (
        <div className="relative rounded-2xl border border-white/10 bg-zinc-900/80 p-5">
          <button
            type="button"
            onClick={() => {
              setSelectedBundle(null);
              setProofResult(null);
            }}
            className="absolute right-4 top-4 rounded-md p-1 text-zinc-500 transition hover:bg-white/5 hover:text-zinc-300"
            aria-label="Close proof details"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-2">
            <Fingerprint className="h-4 w-4 text-amber-400" />
            <p className="text-sm font-semibold text-zinc-200">Verify Proof — {selectedBundle.bundleId}</p>
          </div>

          <div className="mt-4 flex items-center gap-2">
            {proofResult.valid ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            ) : (
              <ShieldAlert className="h-5 w-5 text-rose-400" />
            )}
            <span className={`text-sm font-medium ${proofResult.valid ? 'text-emerald-300' : 'text-rose-300'}`}>
              {proofResult.valid ? 'Proof VALID' : 'Proof INVALID'}
            </span>
          </div>

          <p className="mt-2 text-xs text-zinc-400">{proofResult.reason}</p>

          <dl className="mt-4 grid gap-2 text-[11px] sm:grid-cols-2">
            <DetailItem label="Agent" value={selectedBundle.agentId} />
            <DetailItem label="Action" value={selectedBundle.actionType} />
            <DetailItem label="Request Hash" value={selectedBundle.requestHash.slice(0, 24) + '…'} />
            <DetailItem label="Response Hash" value={selectedBundle.responseHash.slice(0, 24) + '…'} />
            <DetailItem label="Signature" value={selectedBundle.cryptographicSignature.slice(0, 24) + '…'} />
            <DetailItem label="Merkle Root" value={tree.rootHash.slice(0, 24) + '…'} />
          </dl>

          {proofResult.proof ? (
            <div className="mt-4 rounded-lg border border-white/5 bg-zinc-950/60 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                Merkle Proof Path ({proofResult.proof.steps.length} steps)
              </p>
              <ul className="mt-2 space-y-1">
                {proofResult.proof.steps.map((step, index) => (
                  <li key={index} className="flex items-center gap-2 font-mono text-[10px] text-zinc-500">
                    <GitBranch className="h-3 w-3 shrink-0" />
                    {step.position}: {step.hash.slice(0, 20)}…
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function EvidenceSection({
  title,
  subtitle,
  bundles,
  tone,
  onVerify,
}: {
  title: string;
  subtitle: string;
  bundles: EvidenceBundle[];
  tone: 'verified' | 'unverified';
  onVerify: (bundle: EvidenceBundle) => void;
}) {
  const border = tone === 'verified' ? 'border-emerald-500/25' : 'border-rose-500/25';
  const headerBg = tone === 'verified' ? 'bg-emerald-500/5' : 'bg-rose-500/5';

  return (
    <section className={`overflow-hidden rounded-2xl border ${border} bg-zinc-950/60`}>
      <header className={`border-b border-white/10 px-5 py-4 ${headerBg}`}>
        <p className="text-xs font-bold tracking-wider text-zinc-200">{title}</p>
        <p className="mt-0.5 text-[11px] text-zinc-500">{subtitle}</p>
      </header>
      <ul className="divide-y divide-white/5">
        {bundles.length === 0 ? (
          <li className="px-5 py-8 text-center text-sm text-zinc-600">No actions in this category.</li>
        ) : (
          bundles.map((bundle) => (
            <li key={bundle.bundleId} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div>
                <p className="font-medium text-zinc-200">{bundle.actionType}</p>
                <p className="font-mono text-[10px] text-zinc-500">{bundle.bundleId}</p>
                <p className="mt-1 text-[10px] text-zinc-600">{bundle.agentId}</p>
              </div>
              <button
                type="button"
                onClick={() => onVerify(bundle)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-[11px] font-medium text-amber-200 transition hover:bg-amber-500/15"
              >
                <Fingerprint className="h-3.5 w-3.5" />
                Verify Proof
              </button>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: typeof ShieldCheck;
  tone: 'emerald' | 'rose';
}) {
  const accent = tone === 'emerald' ? 'text-emerald-400' : 'text-rose-400';
  const border = tone === 'emerald' ? 'border-emerald-500/20' : 'border-rose-500/20';

  return (
    <div className={`rounded-2xl border ${border} bg-zinc-900/60 p-5`}>
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-400">{label}</p>
        <Icon className={`h-4 w-4 ${accent}`} />
      </div>
      <p className="mt-2 text-3xl font-semibold text-zinc-100">{value}</p>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-zinc-600">{label}</dt>
      <dd className="font-mono text-zinc-400">{value}</dd>
    </div>
  );
}
