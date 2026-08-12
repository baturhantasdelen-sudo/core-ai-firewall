'use client';

import { useState } from 'react';
import { GitCommit } from 'lucide-react';
import { ScanRecord } from '@/lib/mock-dashboard-data';
import { FindingBadge, StatusBadge } from './badges';
import { ScanDetailModal } from './ScanDetailModal';

interface ScanHistoryTableProps {
  scans: ScanRecord[];
}

const MAX_VISIBLE_FINDING_BADGES = 3;

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

export function ScanHistoryTable({ scans }: ScanHistoryTableProps) {
  const [selectedScan, setSelectedScan] = useState<ScanRecord | null>(null);

  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-zinc-900/60 backdrop-blur-sm">
      <div className="border-b border-white/10 px-5 py-4">
        <h2 className="text-sm font-semibold text-zinc-200">Scan History</h2>
        <p className="mt-0.5 text-xs text-zinc-500">Click a row to inspect detected findings.</p>
      </div>

      {scans.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-zinc-500">
          Henüz bir tarama kaydı yok. Bir push veya pull request yapıldığında burada görünecek.
        </p>
      ) : (
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-zinc-500">
              <th className="px-5 py-3 font-medium">Repo Name</th>
              <th className="px-5 py-3 font-medium">Commit</th>
              <th className="px-5 py-3 font-medium">PR</th>
              <th className="px-5 py-3 font-medium">Findings</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {scans.map((scan) => {
              const uniqueTypes = Array.from(new Set(scan.findings.map((finding) => finding.type)));
              const visibleTypes = uniqueTypes.slice(0, MAX_VISIBLE_FINDING_BADGES);
              const remainingCount = uniqueTypes.length - visibleTypes.length;

              return (
                <tr
                  key={scan.id}
                  onClick={() => setSelectedScan(scan)}
                  className="cursor-pointer transition-colors hover:bg-white/[0.03]"
                >
                  <td className="px-5 py-3.5 font-medium text-zinc-200">{scan.repoName}</td>
                  <td className="px-5 py-3.5">
                    <span className="inline-flex items-center gap-1.5 font-mono text-xs text-zinc-400">
                      <GitCommit className="h-3.5 w-3.5 text-zinc-600" />
                      {scan.commitSha.slice(0, 7)}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-zinc-400">
                    {scan.prNumber !== null ? `#${scan.prNumber}` : '—'}
                  </td>
                  <td className="px-5 py-3.5">
                    {uniqueTypes.length === 0 ? (
                      <span className="text-xs text-zinc-600">—</span>
                    ) : (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {visibleTypes.map((type) => (
                          <FindingBadge key={type} type={type} />
                        ))}
                        {remainingCount > 0 ? (
                          <span className="text-[11px] text-zinc-500">+{remainingCount} more</span>
                        ) : null}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <StatusBadge status={scan.status} />
                  </td>
                  <td className="px-5 py-3.5 text-xs text-zinc-500">{formatDate(scan.createdAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      )}

      {selectedScan ? (
        <ScanDetailModal scan={selectedScan} onClose={() => setSelectedScan(null)} />
      ) : null}
    </div>
  );
}
