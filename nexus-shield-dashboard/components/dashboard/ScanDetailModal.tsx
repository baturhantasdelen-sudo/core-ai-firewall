'use client';

import { useEffect } from 'react';
import { FileWarning, GitCommit, X } from 'lucide-react';
import { ScanRecord } from '@/lib/mock-dashboard-data';
import { FindingBadge, SecretValidationBadge, StatusBadge } from './badges';

interface ScanDetailModalProps {
  scan: ScanRecord;
  onClose: () => void;
}

export function ScanDetailModal({ scan, onClose }: ScanDetailModalProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-2xl border border-white/10 bg-zinc-900 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-white/10 p-6">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-zinc-100">{scan.repoName}</h2>
              <StatusBadge status={scan.status} />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
              <span className="inline-flex items-center gap-1 font-mono">
                <GitCommit className="h-3.5 w-3.5" />
                {scan.commitSha.slice(0, 7)}
              </span>
              {scan.prNumber !== null ? <span>PR #{scan.prNumber}</span> : null}
              <span>{new Date(scan.createdAt).toLocaleString()}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-200"
            aria-label="Close"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-6">
          {scan.findings.length === 0 ? (
            <p className="text-sm text-zinc-500">No PII or secret leaks detected in this scan.</p>
          ) : (
            <ul className="space-y-3">
              {scan.findings.map((finding, index) => (
                <li
                  key={`${finding.filePath}-${finding.line}-${index}`}
                  className="rounded-xl border border-white/10 bg-zinc-950/60 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-sm text-zinc-300">
                      <FileWarning className="h-4 w-4 text-zinc-500" />
                      <code className="font-mono text-xs sm:text-sm">{finding.filePath}</code>
                      <span className="text-zinc-600">·</span>
                      <span className="text-xs text-zinc-500">line {finding.line}</span>
                    </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <FindingBadge type={finding.type} />
                    <SecretValidationBadge validation={finding.validation} />
                  </div>
                  </div>
                  {finding.validation?.message ? (
                    <p className="mt-2 text-xs text-zinc-400">{finding.validation.message}</p>
                  ) : null}
                  <pre className="mt-3 overflow-x-auto rounded-lg border border-white/5 bg-zinc-950 px-3 py-2 font-mono text-xs text-rose-300">
                    {finding.preview}
                  </pre>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
