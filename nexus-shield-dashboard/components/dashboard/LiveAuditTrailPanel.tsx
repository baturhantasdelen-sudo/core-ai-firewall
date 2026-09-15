'use client';

import { useCallback, useEffect, useState } from 'react';
import { Activity, Loader2, RefreshCw, Shield } from 'lucide-react';
import { EvidenceModal } from '@/components/EvidenceModal';
import { RiskFlagBadge } from '@/components/RiskFlagBadge';
import {
  countVerifiedModules,
  fetchGovernanceStatus,
  type GovernanceStatusResponse,
} from '@/lib/governance/status';
import {
  decisionBadgeLabel,
  decisionBadgeTone,
  fetchAuditTrail,
  formatUtcTimestamp,
  riskLevelTone,
  truncateHash,
  type AuditTrailEntry,
} from '@/lib/governance/audit-trail';

interface LiveAuditTrailPanelProps {
  initialEntries?: AuditTrailEntry[];
  initialGovernance?: GovernanceStatusResponse | null;
}

function LoadingRows() {
  return (
    <>
      {Array.from({ length: 4 }).map((_, index) => (
        <tr key={`loading-${index}`} className="animate-pulse">
          {Array.from({ length: 8 }).map((__, cell) => (
            <td key={cell} className="px-4 py-3">
              <div className="h-4 rounded bg-zinc-800/80" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function LiveAuditTrailPanel({
  initialEntries = [],
  initialGovernance = null,
}: LiveAuditTrailPanelProps) {
  const [entries, setEntries] = useState<AuditTrailEntry[]>(initialEntries);
  const [governance, setGovernance] = useState<GovernanceStatusResponse | null>(initialGovernance);
  const [selectedEntry, setSelectedEntry] = useState<AuditTrailEntry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastSynced, setLastSynced] = useState<string | null>(null);

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const [audit, status] = await Promise.all([
        fetchAuditTrail(50),
        fetchGovernanceStatus().catch(() => null),
      ]);
      setEntries(audit.entries);
      setLastSynced(audit.timestamp);
      if (status) setGovernance(status);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Audit trail unavailable');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void refresh(true);
    }, 10_000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  const verifiedModules = governance ? countVerifiedModules(governance.modules) : null;

  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/60">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-4 sm:px-5">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 shrink-0 text-violet-400" />
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-300">
              Live Audit Trail
            </h2>
            <p className="mt-0.5 text-xs text-zinc-500">
              Real-time feed from{' '}
              <span className="font-mono text-zinc-400">/api/governance/audit-trail</span>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {verifiedModules !== null ? (
            <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-200">
              Governance {verifiedModules}/13
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-zinc-900/60 px-2.5 py-1.5 text-xs text-zinc-300 transition hover:bg-zinc-800 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Refresh
          </button>
        </div>
      </header>

      {error ? (
        <div className="border-b border-rose-500/20 bg-rose-500/5 px-4 py-3 text-sm text-rose-300 sm:px-5">
          {error}
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="min-w-[960px] w-full text-left text-xs">
          <thead className="border-b border-white/10 bg-zinc-900/50 text-[10px] uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Timestamp (UTC)</th>
              <th className="px-4 py-3 font-semibold">Agent ID</th>
              <th className="px-4 py-3 font-semibold">Session ID</th>
              <th className="px-4 py-3 font-semibold">Tool Name</th>
              <th className="px-4 py-3 font-semibold">Risk Level</th>
              <th className="px-4 py-3 font-semibold">Risk Flags</th>
              <th className="px-4 py-3 font-semibold">Decision / Status</th>
              <th className="px-4 py-3 font-semibold">Evidence Hash / ID</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading && entries.length === 0 ? <LoadingRows /> : null}
            {!loading && entries.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center">
                  <p className="text-sm text-zinc-400">No audit events yet</p>
                  <p className="mt-1 text-xs text-zinc-600">
                    Agent actions evaluated through governance will appear here automatically.
                  </p>
                </td>
              </tr>
            ) : (
              entries.map((entry) => (
                <tr
                  key={`${entry.entry_hash ?? entry.timestamp}-${entry.tool_name}-${entry.session_id}`}
                  className="cursor-pointer transition hover:bg-white/[0.03]"
                  onClick={() => setSelectedEntry(entry)}
                >
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-[10px] text-zinc-400">
                    {formatUtcTimestamp(entry.timestamp)}
                  </td>
                  <td className="max-w-[8rem] truncate px-4 py-3 font-mono text-zinc-300" title={entry.agent_id}>
                    {entry.agent_id}
                  </td>
                  <td className="max-w-[8rem] truncate px-4 py-3 font-mono text-zinc-400" title={entry.session_id}>
                    {entry.session_id}
                  </td>
                  <td className="px-4 py-3 font-mono text-violet-300">{entry.tool_name}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${riskLevelTone(entry.evaluated_risk_level)}`}
                    >
                      {entry.evaluated_risk_level}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex max-w-[14rem] flex-wrap gap-1">
                      {entry.risk_flags.length === 0 ? (
                        <span className="text-[10px] text-zinc-600">—</span>
                      ) : (
                        entry.risk_flags.map((flag) => <RiskFlagBadge key={flag} flag={flag} />)
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${decisionBadgeTone(entry.decision)}`}
                    >
                      {decisionBadgeLabel(entry.decision)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedEntry(entry);
                      }}
                      className="group inline-flex max-w-[10rem] flex-col items-start gap-0.5 text-left"
                    >
                      <span className="font-mono text-[10px] text-cyan-300 group-hover:text-cyan-200">
                        {truncateHash(entry.payload_hash, 16)}
                      </span>
                      <span className="font-mono text-[9px] text-zinc-500 group-hover:text-zinc-400">
                        {entry.evidence_id ?? '—'}
                      </span>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-white/5 px-4 py-3 text-[11px] text-zinc-500 sm:px-5">
        <span className="inline-flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5 text-violet-400" />
          Polling every 10s
        </span>
        {lastSynced ? <span>Last sync: {formatUtcTimestamp(lastSynced)}</span> : null}
        <span>{entries.length} events loaded</span>
      </div>

      {selectedEntry ? (
        <EvidenceModal log={selectedEntry} onClose={() => setSelectedEntry(null)} />
      ) : null}
    </section>
  );
}
