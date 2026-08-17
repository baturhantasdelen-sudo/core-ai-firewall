'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import {
  Globe,
  Radio,
  Send,
  Shield,
  ShieldCheck,
  UserCheck,
  Wifi,
} from 'lucide-react';
import {
  buildMockThreatIndicators,
  listThreatFeedSignals,
  listThreatIndicators,
  publishThreatIndicator,
  resetThreatIntelStore,
  syncCollectiveThreats,
  type ThreatIndicator,
} from '@/lib/threat-intel';
import {
  buildB2BTrustMatrix,
  buildMockAgentPassports,
  issueAgentPassport,
  listAgentPassports,
  resetTrustNetworkStore,
  verifyAgentPassport,
  type AgentPassport,
  type B2BTrustMatrixEntry,
} from '@/lib/trust-network';

function severityTone(severity: ThreatIndicator['severity']): string {
  switch (severity) {
    case 'CRITICAL':
      return 'border-rose-500/40 bg-rose-500/15 text-rose-200';
    case 'HIGH':
      return 'border-orange-500/30 bg-orange-500/10 text-orange-200';
    default:
      return 'border-amber-500/30 bg-amber-500/10 text-amber-200';
  }
}

function trustLevelTone(level: B2BTrustMatrixEntry['trustLevel']): string {
  switch (level) {
    case 'FULL_TRUST':
      return 'text-emerald-300';
    case 'LIMITED_TRUST':
      return 'text-amber-300';
    default:
      return 'text-rose-300';
  }
}

export function MeshTrustPanel() {
  const [indicators, setIndicators] = useState<ThreatIndicator[]>([]);
  const [passports, setPassports] = useState<AgentPassport[]>([]);
  const [matrix, setMatrix] = useState<B2BTrustMatrixEntry[]>([]);
  const [feedCount, setFeedCount] = useState(0);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const refresh = useCallback(() => {
    setIndicators(listThreatIndicators());
    setPassports(listAgentPassports());
    setMatrix(buildB2BTrustMatrix());
    setFeedCount(listThreatFeedSignals().length);
  }, []);

  useEffect(() => {
    resetThreatIntelStore();
    resetTrustNetworkStore();
    buildMockThreatIndicators();
    buildMockAgentPassports();
    refresh();
  }, [refresh]);

  const verifiedPassports = useMemo(
    () => passports.filter((passport) => verifyAgentPassport(passport).valid).length,
    [passports],
  );

  function handleBroadcastThreat() {
    startTransition(() => {
      const result = publishThreatIndicator({
        threatType: 'ZERO_DAY_TRAJECTORY',
        rawPattern: 'read_invoice→bulk_export_db→external_api — agent-crewai-ops-1',
        severity: 'CRITICAL',
        sourceAgentId: 'crewai-ops-agent-1',
        sourceOrgId: 'nexus-tenant-acme',
      });

      setStatusMessage(
        result.published
          ? `Local threat broadcast — IOC ${result.indicator?.indicatorId}`
          : result.reason ?? 'Broadcast failed',
      );
      refresh();
    });
  }

  function handleSyncFeed() {
    startTransition(() => {
      const result = syncCollectiveThreats();
      setStatusMessage(
        `Global feed synced — ${result.newIndicators} new IOC(s), ${result.totalIndicators} total`,
      );
      refresh();
    });
  }

  function handleIssuePassport() {
    startTransition(() => {
      const passport = issueAgentPassport({
        agentId: 'openai-assistant-1',
        agentName: 'Cross-Enterprise Assistant',
        organizationId: 'nexus-tenant-partner-co',
        reputationScore: 88,
        trustTier: 'VERIFIED',
        evidenceProofHash: 'evidence-cross-enterprise-bundle-hash',
        jitScopes: ['READ', 'API_CALL'],
        ttlHours: 48,
      });

      const verification = verifyAgentPassport(passport);
      setStatusMessage(
        verification.valid
          ? `Passport issued — ${passport.passportId} (${verification.trustLevel})`
          : verification.reason ?? 'Passport verification failed',
      );
      refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-500">
            Mesh Trust &amp; Global Command Center
          </h2>
          <p className="mt-1 text-xs text-zinc-600">
            P3 Sprint 19-20 — collective threat intel · verifiable agent passports · B2B trust matrix
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatPill label="Global IOCs" value={indicators.length} icon={Globe} />
          <StatPill label="Feed Signals" value={feedCount} icon={Wifi} />
          <StatPill label="Verified Passports" value={verifiedPassports} icon={UserCheck} />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleBroadcastThreat}
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/20 disabled:opacity-50"
        >
          <Send className="h-3.5 w-3.5" />
          Broadcast Local Threat
        </button>
        <button
          type="button"
          onClick={handleSyncFeed}
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-500/20 disabled:opacity-50"
        >
          <Radio className="h-3.5 w-3.5" />
          Sync Global Threat Feed
        </button>
        <button
          type="button"
          onClick={handleIssuePassport}
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/20 disabled:opacity-50"
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          Issue Cross-Enterprise Passport
        </button>
      </div>

      {statusMessage ? (
        <p className="rounded-lg border border-white/10 bg-zinc-900/60 px-4 py-2 text-xs text-zinc-300">
          {statusMessage}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-white/10 bg-zinc-900/50 p-5">
          <div className="mb-4 flex items-center gap-2">
            <Globe className="h-4 w-4 text-rose-400" />
            <h3 className="text-sm font-semibold text-zinc-200">Collective Threat Feed (IOCs)</h3>
          </div>
          <div className="space-y-3">
            {indicators.map((indicator) => (
              <div
                key={indicator.indicatorId}
                className="rounded-xl border border-white/10 bg-zinc-950/40 p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-mono text-xs text-zinc-300">{indicator.indicatorId}</p>
                    <p className="mt-0.5 text-[11px] text-zinc-500">{indicator.threatType.replace(/_/g, ' ')}</p>
                  </div>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${severityTone(indicator.severity)}`}>
                    {indicator.severity}
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 text-[11px] text-zinc-400">{indicator.patternSummary}</p>
                <p className="mt-1 font-mono text-[10px] text-zinc-600">
                  hash {indicator.indicatorHash.slice(0, 16)}… · source {indicator.anonymizedSource}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-zinc-900/50 p-5">
          <div className="mb-4 flex items-center gap-2">
            <Shield className="h-4 w-4 text-emerald-400" />
            <h3 className="text-sm font-semibold text-zinc-200">Verifiable Agent Passports</h3>
          </div>
          <div className="space-y-3">
            {passports.map((passport) => {
              const verification = verifyAgentPassport(passport);
              return (
                <div
                  key={passport.passportId}
                  className="rounded-xl border border-white/10 bg-zinc-950/40 p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-zinc-100">{passport.agentName}</p>
                      <p className="font-mono text-[10px] text-zinc-500">{passport.passportId}</p>
                    </div>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                        verification.valid
                          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                          : 'border-rose-500/40 bg-rose-500/15 text-rose-200'
                      }`}
                    >
                      {verification.trustLevel}
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-[10px]">
                    <p className="text-zinc-500">Reputation <span className="text-zinc-200">{passport.reputationScore}</span></p>
                    <p className="text-zinc-500">Tier <span className="text-zinc-200">{passport.trustTier}</span></p>
                    <p className="text-zinc-500">JIT <span className="text-zinc-200">{passport.jitScopes.join(', ')}</span></p>
                    <p className="text-zinc-500">Status <span className="text-zinc-200">{passport.status}</span></p>
                  </div>
                  <p className="mt-1 font-mono text-[10px] text-zinc-600">
                    proof {passport.evidenceProofHash.slice(0, 14)}…
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-white/10 bg-zinc-900/50 p-5">
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          B2B Trust Matrix
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[11px]">
            <thead>
              <tr className="border-b border-white/10 text-zinc-500">
                <th className="px-3 py-2">Source Org</th>
                <th className="px-3 py-2">Target Org</th>
                <th className="px-3 py-2">Trust Level</th>
                <th className="px-3 py-2">Allowed Interactions</th>
              </tr>
            </thead>
            <tbody>
              {matrix.map((entry) => (
                <tr key={`${entry.sourceOrgHash}-${entry.targetOrgHash}`} className="border-b border-white/5">
                  <td className="px-3 py-2 font-mono text-zinc-400">{entry.sourceOrgHash}</td>
                  <td className="px-3 py-2 font-mono text-zinc-400">{entry.targetOrgHash}</td>
                  <td className={`px-3 py-2 font-semibold ${trustLevelTone(entry.trustLevel)}`}>
                    {entry.trustLevel.replace(/_/g, ' ')}
                  </td>
                  <td className="px-3 py-2 text-zinc-400">
                    {entry.allowedInteractions.length > 0
                      ? entry.allowedInteractions.join(', ')
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function StatPill({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof Globe;
}) {
  return (
    <div className="rounded-xl border border-indigo-500/25 bg-indigo-500/10 px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-300/70">{label}</p>
        <Icon className="h-3.5 w-3.5 text-indigo-300/70" />
      </div>
      <p className="mt-1 text-lg font-bold text-indigo-100">{value}</p>
    </div>
  );
}
