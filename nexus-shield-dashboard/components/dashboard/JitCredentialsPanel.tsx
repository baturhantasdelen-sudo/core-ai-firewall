'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import {
  Clock,
  KeyRound,
  Play,
  ShieldAlert,
  ShieldOff,
  Zap,
} from 'lucide-react';
import {
  DEFAULT_JIT_TTL_SECONDS,
  listAllJitCredentials,
  remainingTtlMs,
  requestJitCredential,
  resetJitCredentialBrokerStore,
  revokeAgentTokensOnRiskEscalation,
  revokeJitCredential,
  ttlPercentRemaining,
  type CredentialScope,
  type JitCredential,
} from '@/lib/credentials';

const DEMO_AGENT_ID = 'crewai-ops-agent-1';

function scopeTone(scope: CredentialScope): string {
  switch (scope) {
    case 'READ':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200';
    case 'WRITE':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-200';
    case 'EXECUTE':
      return 'border-rose-500/30 bg-rose-500/10 text-rose-200';
  }
}

function statusTone(status: JitCredential['status']): string {
  switch (status) {
    case 'ACTIVE':
      return 'border-cyan-500/30 bg-cyan-500/10 text-cyan-200';
    case 'EXPIRED':
      return 'border-zinc-500/30 bg-zinc-500/10 text-zinc-400';
    case 'REVOKED':
      return 'border-rose-500/40 bg-rose-500/15 text-rose-200';
  }
}

function ttlBarTone(percent: number): string {
  if (percent <= 15) return 'bg-rose-500';
  if (percent <= 40) return 'bg-amber-500';
  return 'bg-cyan-500';
}

export function JitCredentialsPanel() {
  const [credentials, setCredentials] = useState<JitCredential[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const refresh = useCallback(() => {
    setCredentials(listAllJitCredentials());
  }, []);

  useEffect(() => {
    resetJitCredentialBrokerStore();
    requestJitCredential({
      agentId: 'langchain-support-agent-1',
      targetResource: 'invoices/read',
      scope: 'READ',
      riskScore: 12,
      ttlSeconds: DEFAULT_JIT_TTL_SECONDS,
    });
    requestJitCredential({
      agentId: DEMO_AGENT_ID,
      targetResource: 'customer-database/read',
      scope: 'READ',
      riskScore: 22,
      ttlSeconds: DEFAULT_JIT_TTL_SECONDS,
    });
    refresh();
  }, [refresh]);

  useEffect(() => {
    const interval = setInterval(refresh, 500);
    return () => clearInterval(interval);
  }, [refresh]);

  const activeCount = useMemo(
    () => credentials.filter((credential) => credential.status === 'ACTIVE').length,
    [credentials],
  );

  function handleRequestToken() {
    startTransition(() => {
      const result = requestJitCredential({
        agentId: DEMO_AGENT_ID,
        targetResource: 'customer-database/export',
        scope: 'WRITE',
        riskScore: 40,
        ttlSeconds: DEFAULT_JIT_TTL_SECONDS,
      });

      if (result.granted && result.credential) {
        setStatusMessage(`JIT token issued · ${result.credential.tokenId} · ${DEFAULT_JIT_TTL_SECONDS}s TTL`);
      } else {
        setStatusMessage(result.reason ?? 'Token request denied by policy engine');
      }
      refresh();
    });
  }

  function handleRiskEscalation() {
    startTransition(() => {
      const result = revokeAgentTokensOnRiskEscalation(DEMO_AGENT_ID, 92);
      setStatusMessage(result.reason ?? `Revoked ${result.revokedCount} token(s)`);
      refresh();
    });
  }

  function handleForceRevoke(tokenId: string) {
    startTransition(() => {
      const result = revokeJitCredential(tokenId, 'Force revoke from control panel');
      setStatusMessage(result.revoked ? `Token ${tokenId} revoked` : result.reason ?? 'Revoke failed');
      refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-500">
            JIT Ephemeral Credentials Broker
          </h2>
          <p className="mt-1 text-xs text-zinc-600">
            P1 Sprint 11-12 — {DEFAULT_JIT_TTL_SECONDS}s TTL · policy-gated · instant revocation
          </p>
        </div>
        <div className="rounded-xl border border-violet-500/25 bg-violet-500/10 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-300/80">Active Tokens</p>
          <p className="mt-1 text-2xl font-bold text-violet-100">{activeCount}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleRequestToken}
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-500/20 disabled:opacity-50"
        >
          <Play className="h-3.5 w-3.5" />
          Request 30s JIT Token
        </button>
        <button
          type="button"
          onClick={handleRiskEscalation}
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/20 disabled:opacity-50"
        >
          <Zap className="h-3.5 w-3.5" />
          Simulate Risk Escalation &amp; Revoke
        </button>
      </div>

      {statusMessage ? (
        <p className="rounded-lg border border-white/10 bg-zinc-900/60 px-4 py-2 text-xs text-zinc-300">
          {statusMessage}
        </p>
      ) : null}

      <div className="space-y-3">
        {credentials.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-zinc-900/30 px-6 py-10 text-center text-sm text-zinc-500">
            No ephemeral credentials in broker store
          </div>
        ) : (
          credentials.map((credential) => (
            <CredentialCard
              key={credential.tokenId}
              credential={credential}
              onForceRevoke={handleForceRevoke}
            />
          ))
        )}
      </div>
    </div>
  );
}

function CredentialCard({
  credential,
  onForceRevoke,
}: {
  credential: JitCredential;
  onForceRevoke: (tokenId: string) => void;
}) {
  const remainingMs = remainingTtlMs(credential);
  const ttlPercent = ttlPercentRemaining(credential, DEFAULT_JIT_TTL_SECONDS);
  const remainingSec = Math.ceil(remainingMs / 1000);
  const isActive = credential.status === 'ACTIVE' && remainingMs > 0;

  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-900/50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-lg border border-violet-500/20 bg-violet-500/10 p-2">
            <KeyRound className="h-4 w-4 text-violet-300" />
          </div>
          <div>
            <p className="font-mono text-xs text-zinc-300">{credential.tokenId}</p>
            <p className="mt-1 text-sm text-zinc-200">{credential.targetResource}</p>
            <p className="mt-0.5 text-[11px] text-zinc-500">agent · {credential.agentId}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${scopeTone(credential.scope)}`}>
            {credential.scope}
          </span>
          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusTone(credential.status)}`}>
            {credential.status}
          </span>
        </div>
      </div>

      {isActive ? (
        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between text-[10px] text-zinc-500">
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              TTL countdown
            </span>
            <span className="font-mono text-cyan-300/80">{remainingSec}s remaining</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
            <div
              className={`h-full rounded-full transition-all duration-500 ${ttlBarTone(ttlPercent)}`}
              style={{ width: `${Math.max(0, Math.min(100, ttlPercent))}%` }}
            />
          </div>
        </div>
      ) : credential.status === 'REVOKED' ? (
        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-rose-300/80">
          <ShieldOff className="h-3 w-3" />
          Token revoked — access terminated
        </p>
      ) : (
        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-zinc-500">
          <ShieldAlert className="h-3 w-3" />
          Token expired
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] text-zinc-600">
          Risk at issue {credential.riskScoreAtIssue} · issued {credential.issuedAt.slice(11, 19)}
        </p>
        {isActive ? (
          <button
            type="button"
            onClick={() => onForceRevoke(credential.tokenId)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-rose-200 transition hover:bg-rose-500/20"
          >
            <ShieldOff className="h-3 w-3" />
            Force Revoke
          </button>
        ) : null}
      </div>
    </div>
  );
}
