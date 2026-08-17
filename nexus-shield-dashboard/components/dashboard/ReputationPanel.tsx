'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Award,
  Minus,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  TrendingUp,
  Zap,
} from 'lucide-react';
import {
  buildMockAgentReputations,
  getTrustPolicyAction,
  listAgentReputations,
  resetReputationEngineStore,
  simulatePositiveActivity,
  simulateSecurityViolation,
  type AgentReputation,
  type TrustTier,
} from '@/lib/reputation';

const DEMO_AGENT_ID = 'crewai-ops-agent-1';

function tierTone(tier: TrustTier): string {
  switch (tier) {
    case 'VERIFIED':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200';
    case 'NEUTRAL':
      return 'border-cyan-500/30 bg-cyan-500/10 text-cyan-200';
    case 'HIGH_RISK':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-200';
    case 'UNTRUSTED':
      return 'border-rose-500/40 bg-rose-500/15 text-rose-200';
  }
}

function tierIcon(tier: TrustTier) {
  switch (tier) {
    case 'VERIFIED':
      return ShieldCheck;
    case 'NEUTRAL':
      return Award;
    case 'HIGH_RISK':
      return ShieldAlert;
    case 'UNTRUSTED':
      return ShieldX;
  }
}

function scoreBarTone(score: number): string {
  if (score >= 85) return 'bg-emerald-500';
  if (score >= 60) return 'bg-cyan-500';
  if (score >= 35) return 'bg-amber-500';
  return 'bg-rose-500';
}

function TrendIcon({ trend }: { trend: AgentReputation['trend'] }) {
  if (trend === 'IMPROVING') return <ArrowUpRight className="h-3.5 w-3.5 text-emerald-400" />;
  if (trend === 'DECLINING') return <ArrowDownRight className="h-3.5 w-3.5 text-rose-400" />;
  return <Minus className="h-3.5 w-3.5 text-zinc-500" />;
}

export function ReputationPanel() {
  const [reputations, setReputations] = useState<AgentReputation[]>([]);
  const [selectedId, setSelectedId] = useState<string>(DEMO_AGENT_ID);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const refresh = useCallback(() => {
    setReputations(listAgentReputations());
  }, []);

  useEffect(() => {
    resetReputationEngineStore();
    buildMockAgentReputations();
    refresh();
  }, [refresh]);

  const selected = useMemo(
    () => reputations.find((reputation) => reputation.agentId === selectedId) ?? reputations[0],
    [reputations, selectedId],
  );

  const policy = useMemo(
    () => (selected ? getTrustPolicyAction(selected) : null),
    [selected],
  );

  const fleetAvg = useMemo(() => {
    if (reputations.length === 0) return 0;
    return Math.round(
      reputations.reduce((sum, reputation) => sum + reputation.reputationScore, 0) /
        reputations.length,
    );
  }, [reputations]);

  function handlePositiveActivity() {
    startTransition(() => {
      const result = simulatePositiveActivity(DEMO_AGENT_ID, 'Ops Coordinator');
      setSelectedId(DEMO_AGENT_ID);
      setStatusMessage(
        `Positive activity recorded — reputation ${result.reputationScore}/100 (${result.trustTier})`,
      );
      refresh();
    });
  }

  function handleSecurityViolation() {
    startTransition(() => {
      const result = simulateSecurityViolation(DEMO_AGENT_ID, 'Ops Coordinator');
      setSelectedId(DEMO_AGENT_ID);
      const action = getTrustPolicyAction(result);
      setStatusMessage(`${action.message} — score ${result.reputationScore}/100`);
      refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-500">
            Agent Reputation Scorecard &amp; Dynamic Trust
          </h2>
          <p className="mt-1 text-xs text-zinc-600">
            P2 Sprint 17-18 — P0/P1/P2 signal fusion · trust tier policy · fleet scorecard
          </p>
        </div>
        <div className="rounded-xl border border-teal-500/25 bg-teal-500/10 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-teal-300/80">
            Fleet Avg Reputation
          </p>
          <p className="mt-1 text-2xl font-bold text-teal-100">{fleetAvg}/100</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handlePositiveActivity}
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/20 disabled:opacity-50"
        >
          <TrendingUp className="h-3.5 w-3.5" />
          Simulate Positive Activity
        </button>
        <button
          type="button"
          onClick={handleSecurityViolation}
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/20 disabled:opacity-50"
        >
          <Zap className="h-3.5 w-3.5" />
          Simulate Security Violation
        </button>
      </div>

      {statusMessage ? (
        <p className="rounded-lg border border-white/10 bg-zinc-900/60 px-4 py-2 text-xs text-zinc-300">
          {statusMessage}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        {reputations.map((reputation) => (
          <ReputationCard
            key={reputation.agentId}
            reputation={reputation}
            selected={reputation.agentId === selectedId}
            onSelect={() => setSelectedId(reputation.agentId)}
          />
        ))}
      </div>

      {selected && policy ? (
        <div className="rounded-2xl border border-white/10 bg-zinc-900/50 p-5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Trust Policy — {selected.agentName ?? selected.agentId}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${tierTone(policy.trustTier)}`}>
              {policy.action.replace(/_/g, ' ')}
            </span>
            <p className="text-sm text-zinc-300">{policy.message}</p>
          </div>
          {policy.restrictions.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {policy.restrictions.map((restriction) => (
                <span
                  key={restriction}
                  className="rounded-md border border-amber-500/20 bg-amber-500/5 px-2 py-0.5 text-[10px] text-amber-200"
                >
                  {restriction.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ReputationCard({
  reputation,
  selected,
  onSelect,
}: {
  reputation: AgentReputation;
  selected: boolean;
  onSelect: () => void;
}) {
  const TierIcon = tierIcon(reputation.trustTier);
  const { metrics } = reputation;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`rounded-2xl border p-4 text-left transition ${
        selected
          ? 'border-teal-500/40 bg-teal-500/10'
          : 'border-white/10 bg-zinc-900/50 hover:border-white/20'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-zinc-100">
            {reputation.agentName ?? reputation.agentId}
          </p>
          <p className="mt-0.5 font-mono text-[10px] text-zinc-500">{reputation.agentId}</p>
        </div>
        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${tierTone(reputation.trustTier)}`}>
          <TierIcon className="h-3 w-3" />
          {reputation.trustTier}
        </span>
      </div>

      <div className="mt-4 flex items-end justify-between">
        <div>
          <p className="text-3xl font-bold text-zinc-50">{reputation.reputationScore}</p>
          <p className="text-[10px] text-zinc-500">reputation score</p>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-zinc-400">
          <TrendIcon trend={reputation.trend} />
          {reputation.trend}
        </div>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-800">
        <div
          className={`h-full rounded-full ${scoreBarTone(reputation.reputationScore)}`}
          style={{ width: `${reputation.reputationScore}%` }}
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-[10px]">
        <Metric label="Evidence Verified" value={`${metrics.evidenceVerificationRate}%`} />
        <Metric label="Red Team Resilience" value={`${metrics.resilienceScore}`} />
        <Metric label="Actions" value={`${metrics.totalActions}`} />
        <Metric label="Blocked" value={`${metrics.blockedActions}`} />
        <Metric label="Poison Incidents" value={`${metrics.memoryPoisonIncidents}`} />
        <Metric
          label="Block Rate"
          value={
            metrics.totalActions > 0
              ? `${Math.round((metrics.blockedActions / metrics.totalActions) * 100)}%`
              : '0%'
          }
        />
      </div>
    </button>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/5 bg-zinc-950/40 px-2 py-1.5">
      <p className="text-zinc-500">{label}</p>
      <p className="font-mono text-zinc-200">{value}</p>
    </div>
  );
}
