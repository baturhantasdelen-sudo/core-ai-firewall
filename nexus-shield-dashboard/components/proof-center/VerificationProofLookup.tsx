'use client';

import { useState } from 'react';
import { AlertTriangle, Loader2, ShieldCheck } from 'lucide-react';

type ProofPayload = {
  record_type: 'REAL' | 'DEMO' | 'ESTIMATE' | 'UNKNOWN';
  verification_status: string;
  false_success_detected: boolean;
  post_block_side_effect_detected: boolean;
  provenance_note: string;
  verification: {
    verification_id: string;
    action_id?: string;
    authoritative_source?: string;
    verification_latency_ms?: number;
    verifier_version?: string;
    expected_outcome?: { expected_state?: Record<string, unknown> };
    actual_outcome?: { observed_state?: Record<string, unknown> };
  };
  outcome_diff: Array<{ field: string; severity: string; message?: string; difference: string }>;
  evidence_ids: string[];
  integrity: { hash_chain_valid: boolean; evidence_count: number; last_integrity_hash: string | null };
  hash_chain_valid: boolean;
  signature_status: string;
  uar: { uar_id: string } | null;
};

const RECORD_BADGE: Record<string, string> = {
  REAL: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
  DEMO: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
  ESTIMATE: 'border-zinc-500/40 bg-zinc-500/10 text-zinc-300',
  UNKNOWN: 'border-red-500/40 bg-red-500/10 text-red-200',
};

export function VerificationProofLookup({ initialVerificationId }: { initialVerificationId?: string }) {
  const [verificationId, setVerificationId] = useState(initialVerificationId ?? '');
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proof, setProof] = useState<ProofPayload | null>(null);

  async function loadProof() {
    setLoading(true);
    setError(null);
    setProof(null);
    try {
      const res = await fetch(`/api/v1/proof/verification/${encodeURIComponent(verificationId.trim())}`, {
        headers: apiKey.trim() ? { 'x-nexus-api-key': apiKey.trim() } : {},
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setProof((await res.json()) as ProofPayload);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load verification');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-2xl border border-cyan-500/20 bg-zinc-950/80 p-6">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-cyan-400" />
        <h2 className="text-lg font-semibold text-zinc-50">Persisted verification lookup</h2>
      </div>
      <p className="mt-2 text-sm text-zinc-400">
        Loads durable assurance records via the server API. Requires your organization API key. Hashes
        support integrity checking of recorded data — they are not digital signatures.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <input
          value={verificationId}
          onChange={(e) => setVerificationId(e.target.value)}
          placeholder="verification_id (ov_…)"
          className="rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 font-mono text-sm text-zinc-100"
        />
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="x-nexus-api-key"
          className="rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 font-mono text-sm text-zinc-100"
        />
      </div>
      <button
        type="button"
        disabled={loading || !verificationId.trim() || !apiKey.trim()}
        onClick={() => void loadProof()}
        className="mt-3 inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-zinc-950 disabled:opacity-50"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Load proof
      </button>

      {error ? (
        <p className="mt-4 flex items-start gap-2 text-sm text-red-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {error} — no demo record is shown in place of a failed lookup.
        </p>
      ) : null}

      {proof ? (
        <div className="mt-6 space-y-4 border-t border-white/10 pt-4 text-sm">
          <div className="flex flex-wrap gap-2">
            <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${RECORD_BADGE[proof.record_type] ?? RECORD_BADGE.UNKNOWN}`}>
              {proof.record_type}
            </span>
            <span className="rounded-full border border-white/15 px-2 py-0.5 text-xs text-zinc-200">
              {proof.verification_status}
            </span>
            {proof.false_success_detected ? (
              <span className="rounded-full border border-red-500/40 px-2 py-0.5 text-xs text-red-200">
                false success detected
              </span>
            ) : null}
          </div>
          <p className="text-zinc-400">{proof.provenance_note}</p>
          <dl className="grid gap-2 font-mono text-xs text-zinc-300 sm:grid-cols-2">
            <div>
              <dt className="text-zinc-500">verification_id</dt>
              <dd>{proof.verification.verification_id}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">evidence_count</dt>
              <dd>{proof.integrity.evidence_count}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">hash_chain_valid</dt>
              <dd>{String(proof.hash_chain_valid)}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">signature_status</dt>
              <dd>{proof.signature_status} (SHA-256 hash ≠ digital signature)</dd>
            </div>
            <div>
              <dt className="text-zinc-500">uar_id</dt>
              <dd>{proof.uar?.uar_id ?? '—'}</dd>
            </div>
          </dl>
          {proof.outcome_diff.length > 0 ? (
            <ul className="space-y-1 text-xs text-zinc-300">
              {proof.outcome_diff.map((d) => (
                <li key={d.field}>
                  <span className="text-amber-300">{d.severity}</span> {d.field}: {d.difference}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
