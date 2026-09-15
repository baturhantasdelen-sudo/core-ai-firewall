'use client';

import { useEffect, useState } from 'react';
import { EvidenceModal } from '@/components/EvidenceModal';
import { RiskFlagBadge } from '@/components/RiskFlagBadge';
import type { AuditTrailResponse } from '@/lib/governance/audit-trail';
import {
  auditTrailEntryToLogItem,
  demoAuditLogItem,
  type AuditLogItem,
} from '@/types/trust-hub';

const POLL_MS = 5000;

export function TrustHubAuditStream() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const res = await fetch('/api/governance/audit-trail?limit=50', {
          cache: 'no-store',
          headers: { Accept: 'application/json' },
        });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as AuditTrailResponse;
        setLogs(data.entries.map(auditTrailEntryToLogItem));
      } catch {
        setLogs([demoAuditLogItem()]);
      }
    };

    void fetchLogs();
    const interval = window.setInterval(() => void fetchLogs(), POLL_MS);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-100">Trust Hub Audit Stream</h2>
          <p className="text-sm text-slate-400">
            Real-time agent trajectory inspection &amp; risk flag telemetry
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-400">
          <span className="h-2 w-2 animate-ping rounded-full bg-emerald-400" />
          Live Telemetry Active
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50 shadow-xl">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-800 bg-slate-900 text-xs font-semibold uppercase tracking-wider text-slate-400">
            <tr>
              <th className="p-4">Timestamp</th>
              <th className="p-4">Agent / Session</th>
              <th className="p-4">Tool Requested</th>
              <th className="p-4">Risk Level</th>
              <th className="p-4">Risk Flags</th>
              <th className="p-4">Status</th>
              <th className="p-4 text-right">Evidence</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {logs.map((log) => (
              <tr key={`${log.approval_id}-${log.timestamp}`} className="transition hover:bg-slate-800/40">
                <td className="p-4 text-slate-400">{new Date(log.timestamp).toLocaleTimeString()}</td>
                <td className="p-4">
                  <div className="font-semibold text-slate-200">{log.agent_id}</div>
                  <div className="text-[10px] text-slate-500">{log.session_id}</div>
                </td>
                <td className="p-4 font-bold text-indigo-400">{log.tool_name}</td>
                <td className="p-4">
                  <span
                    className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                      log.evaluated_risk_level === 'HIGH' || log.evaluated_risk_level === 'CRITICAL'
                        ? 'border border-red-500/30 bg-red-500/20 text-red-400'
                        : 'bg-emerald-500/20 text-emerald-400'
                    }`}
                  >
                    {log.evaluated_risk_level}
                  </span>
                </td>
                <td className="p-4">
                  <div className="flex flex-wrap gap-1">
                    {log.risk_flags.map((flag) => (
                      <RiskFlagBadge key={flag} flag={flag} />
                    ))}
                  </div>
                </td>
                <td className="p-4 font-sans">
                  <span className="font-semibold text-amber-400">{log.status}</span>
                </td>
                <td className="p-4 text-right font-sans">
                  <button
                    type="button"
                    onClick={() => setSelectedLog(log)}
                    className="rounded border border-indigo-500/30 bg-indigo-600/20 px-3 py-1 text-xs text-indigo-300 transition hover:bg-indigo-600/40"
                  >
                    Inspect Proof
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedLog ? <EvidenceModal log={selectedLog} onClose={() => setSelectedLog(null)} /> : null}
    </div>
  );
}
