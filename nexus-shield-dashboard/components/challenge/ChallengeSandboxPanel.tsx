'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Copy,
  Fingerprint,
  Loader2,
  Share2,
  Terminal,
  Trophy,
} from 'lucide-react';
import {
  CHALLENGE_LEVELS,
  type ChallengeEvaluation,
  type ChallengeLevelId,
  type ChallengeProofBadge,
} from '@/lib/challenge-engine';

const STORAGE_KEY = 'nexus-challenge-completed';

const LEADERBOARD = [
  { handle: 'agent_sec_01', cleared: 7, score: 700 },
  { handle: 'mcp_hunter', cleared: 6, score: 620 },
  { handle: 'proof_runner', cleared: 5, score: 540 },
  { handle: 'you', cleared: 0, score: 0 },
];

function loadCompleted(): ChallengeLevelId[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ChallengeLevelId[]) : [];
  } catch {
    return [];
  }
}

function saveCompleted(ids: ChallengeLevelId[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

export function ChallengeSandboxPanel() {
  const [levelId, setLevelId] = useState<ChallengeLevelId>(1);
  const [payload, setPayload] = useState('');
  const [agentEndpoint, setAgentEndpoint] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ChallengeEvaluation | null>(null);
  const [completed, setCompleted] = useState<ChallengeLevelId[]>([]);

  const level = CHALLENGE_LEVELS.find((l) => l.id === levelId)!;

  useEffect(() => {
    setCompleted(loadCompleted());
  }, []);

  useEffect(() => {
    setPayload(level.examplePayload);
    setResult(null);
  }, [levelId, level.examplePayload]);

  const progress = completed.length;

  const leaderboard = useMemo(() => {
    const you = { ...LEADERBOARD[3], cleared: progress, score: progress * 100 };
    return [...LEADERBOARD.slice(0, 3), you].sort((a, b) => b.score - a.score);
  }, [progress]);

  const runChallenge = useCallback(async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/challenge/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ levelId, payload, agentEndpoint: agentEndpoint || undefined }),
      });
      const data = (await res.json()) as ChallengeEvaluation & { error?: string };
      if (!res.ok) {
        setResult({
          levelId,
          success: false,
          blocked: false,
          detected: false,
          latencyMs: 0,
          policyFlag: 'ERROR',
          message: data.error ?? 'Evaluation failed',
          proof: null,
        });
        return;
      }
      setResult(data);
      if (data.success && data.proof) {
        setCompleted((prev) => {
          const next = prev.includes(levelId) ? prev : [...prev, levelId];
          saveCompleted(next);
          return next;
        });
      }
    } catch (err) {
      setResult({
        levelId,
        success: false,
        blocked: false,
        detected: false,
        latencyMs: 0,
        policyFlag: 'ERROR',
        message: err instanceof Error ? err.message : 'Network error',
        proof: null,
      });
    } finally {
      setLoading(false);
    }
  }, [levelId, payload, agentEndpoint]);

  const shareProof = async (proof: ChallengeProofBadge) => {
    const text = `Nexus Shield Challenge Level ${proof.levelId} cleared! Verifiable Proof Badge ${proof.badgeId} · sha256:${proof.evidenceHash.slice(0, 16)}…`;
    const url = `${window.location.origin}/challenge?level=${proof.levelId}&proof=${proof.evidenceHash.slice(0, 12)}`;
    if (navigator.share) {
      await navigator.share({ title: 'Nexus Shield Proof Badge', text, url });
    } else {
      await navigator.clipboard.writeText(`${text}\n${url}`);
    }
  };

  return (
    <div data-demo="challenge-sandbox" className="mx-auto max-w-6xl space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-violet-500/20 bg-zinc-900/60 p-5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-400">
            Progress Tracker
          </p>
          <p className="mt-1 text-2xl font-bold text-zinc-50">
            {progress}/7 <span className="text-base font-normal text-zinc-500">levels completed</span>
          </p>
        </div>
        <div className="flex gap-1.5">
          {CHALLENGE_LEVELS.map((l) => (
            <button
              key={l.id}
              type="button"
              title={l.title}
              onClick={() => setLevelId(l.id)}
              className={`h-3 w-8 rounded-full transition ${
                completed.includes(l.id)
                  ? 'bg-emerald-400'
                  : l.id === levelId
                    ? 'bg-violet-400'
                    : 'bg-zinc-700'
              }`}
            />
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-2xl border border-white/10 bg-zinc-950/80 p-5">
            <div className="mb-4 flex flex-wrap gap-2">
              {CHALLENGE_LEVELS.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setLevelId(l.id)}
                  className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition ${
                    l.id === levelId
                      ? 'border-violet-500/40 bg-violet-500/15 text-violet-200'
                      : 'border-white/10 bg-zinc-900 text-zinc-500 hover:border-white/20'
                  }`}
                >
                  L{l.id}: {l.title}
                </button>
              ))}
            </div>

            <h2 className="font-mono text-sm font-bold text-emerald-400">
              Level {level.id} — {level.title}
            </h2>
            <p className="mt-1 text-sm text-zinc-500">{level.subtitle}</p>
            <p className="mt-2 text-xs text-zinc-600">Hint: {level.hint}</p>

            <label className="mt-4 block text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Attack Payload
            </label>
            <textarea
              value={payload}
              onChange={(e) => setPayload(e.target.value)}
              rows={4}
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 p-3 font-mono text-xs text-zinc-200 focus:border-violet-500 focus:outline-none"
            />

            <label className="mt-3 block text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Agent API Endpoint (optional)
            </label>
            <input
              value={agentEndpoint}
              onChange={(e) => setAgentEndpoint(e.target.value)}
              placeholder="https://api.myagent.com/v1/act"
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 font-mono text-xs text-zinc-200 focus:border-violet-500 focus:outline-none"
            />

            <button
              type="button"
              onClick={() => void runChallenge()}
              disabled={loading || !payload.trim()}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 transition hover:scale-[1.02] disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Terminal className="h-4 w-4" />}
              Run Challenge
            </button>
          </div>

          {result ? (
            <div
              className={`rounded-2xl border p-5 font-mono text-xs ${
                result.success
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
                  : 'border-amber-500/30 bg-amber-500/10 text-amber-100'
              }`}
            >
              <p>{result.message}</p>
              {result.proof ? (
                <div className="mt-4 rounded-xl border border-emerald-500/30 bg-black/30 p-4">
                  <div className="flex items-center gap-2 text-emerald-300">
                    <Fingerprint className="h-4 w-4" />
                    Verifiable Cryptographic Proof Badge
                  </div>
                  <p className="mt-2">Badge ID: {result.proof.badgeId}</p>
                  <p>SHA-256: {result.proof.evidenceHash}</p>
                  <p>Policy: {result.proof.policyFlag}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void shareProof(result.proof!)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-200"
                    >
                      <Share2 className="h-3.5 w-3.5" />
                      Share Proof Badge
                    </button>
                    <button
                      type="button"
                      onClick={() => void navigator.clipboard.writeText(result.proof!.evidenceHash)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-[11px] text-zinc-300"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Copy Hash
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-white/10 bg-zinc-950/80 p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
            <Trophy className="h-4 w-4 text-amber-400" />
            Terminal Leaderboard
          </div>
          <ul className="mt-4 space-y-2 font-mono text-xs">
            {leaderboard.map((row, index) => (
              <li
                key={row.handle}
                className={`flex items-center justify-between rounded-lg border px-3 py-2 ${
                  row.handle === 'you'
                    ? 'border-violet-500/30 bg-violet-500/10 text-violet-200'
                    : 'border-white/5 bg-zinc-900/60 text-zinc-400'
                }`}
              >
                <span>
                  #{index + 1} {row.handle}
                </span>
                <span>{row.cleared}/7 · {row.score} pts</span>
              </li>
            ))}
          </ul>
          <Link
            href="/docs"
            className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300"
          >
            Fix with Nexus Shield SDK
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}
