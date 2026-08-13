'use client';

import { useEffect, useMemo, useState } from 'react';
import { FileWarning, GitCommit, X, Zap } from 'lucide-react';
import { DEFAULT_POLICY } from '@/lib/engine/policy';
import { buildPreviewFromFinding } from '@/lib/engine/remediation';
import type { DetectionMatch } from '@/lib/engine/types';
import { ScanRecord } from '@/lib/mock-dashboard-data';
import { AutoFixPreviewModal, type AutoFixPreviewData } from './AutoFixPreviewModal';
import { FindingBadge, SecretValidationBadge, StatusBadge, SuppressedFindingBadge } from './badges';

interface ScanDetailModalProps {
  scan: ScanRecord;
  onClose: () => void;
}

const DEMO_MATCHED: Record<string, string> = {
  TCKN: '10000000146',
  'OpenAI API Key': 'sk-proj-1234567890abcdef1234567890abcdef',
  'Credit Card': '4111111111111111',
  Email: 'user@example.com',
};

const DEMO_RULE_ID: Record<string, string> = {
  TCKN: 'tckn',
  'OpenAI API Key': 'openai-api-key',
  'Credit Card': 'credit-card',
  Email: 'email',
};

function demoFindingToMatch(finding: ScanRecord['findings'][number], index: number): DetectionMatch {
  const matched = finding.matched ?? DEMO_MATCHED[finding.type] ?? finding.preview;
  const ruleId = finding.ruleId ?? DEMO_RULE_ID[finding.type] ?? finding.type.toLowerCase().replace(/\s+/g, '-');
  const category =
    finding.category ??
    (['TCKN', 'Credit Card', 'Email'].includes(finding.type) ? 'pii' : 'secret');

  return {
    ruleId,
    type: finding.type,
    line: finding.line,
    column: finding.column ?? 15,
    preview: finding.preview,
    matched,
    confidence: 'HIGH',
    severity: category === 'secret' ? 'critical' : 'high',
    category,
  };
}

function sampleLineForFinding(finding: ScanRecord['findings'][number], matched: string): string {
  if (finding.type === 'TCKN') {
    return `const customerTckn = "${matched}";`;
  }
  if (finding.type === 'OpenAI API Key') {
    return `const api_key = "${matched}";`;
  }
  if (finding.type === 'Credit Card') {
    return `const cardNumber = "${matched}";`;
  }
  if (finding.type === 'Email') {
    return `const email = "${matched}";`;
  }
  return `const secret = "${matched}";`;
}

export function ScanDetailModal({ scan, onClose }: ScanDetailModalProps) {
  const [previewData, setPreviewData] = useState<AutoFixPreviewData | null>(null);
  const [showSuppressed, setShowSuppressed] = useState(false);
  const policy = useMemo(
    () => ({
      ...DEFAULT_POLICY,
      profile: 'TR' as const,
      remediation: { pii_mask_style: 'partial' as const, secret_use_env: true },
    }),
    [],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (previewData) {
          setPreviewData(null);
          return;
        }
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, previewData]);

  const openAutoFixPreview = (finding: ScanRecord['findings'][number], index: number) => {
    const match = demoFindingToMatch(finding, index);
    const line = sampleLineForFinding(finding, match.matched);
    const preview = buildPreviewFromFinding(match, policy, line);

    setPreviewData({
      type: finding.type,
      ruleId: match.ruleId,
      category: match.category,
      line: finding.line,
      column: match.column,
      matched: match.matched,
      originalLine: preview.originalLine,
      fixedLine: preview.fixedLine,
      diff: preview.diff,
      envExampleLine: preview.fix.envExampleLine ?? null,
    });
  };

  const activeFindings = scan.findings.filter((finding) => !finding.suppressed);
  const suppressedFindings = scan.findings.filter((finding) => finding.suppressed);
  const visibleFindings = showSuppressed ? scan.findings : activeFindings;

  return (
    <>
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
            {suppressedFindings.length > 0 ? (
              <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-zinc-950/40 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-zinc-200">False positive filter</p>
                  <p className="text-xs text-zinc-500">
                    {suppressedFindings.length} suppressed finding(s) hidden from main report
                  </p>
                </div>
                <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-zinc-300">
                  <input
                    type="checkbox"
                    checked={showSuppressed}
                    onChange={(event) => setShowSuppressed(event.target.checked)}
                    className="h-4 w-4 rounded border-white/20 bg-zinc-900 text-emerald-500 focus:ring-emerald-500/40"
                  />
                  Show Suppressed False Positives
                </label>
              </div>
            ) : null}

            {visibleFindings.length === 0 ? (
              <p className="text-sm text-zinc-500">No PII or secret leaks detected in this scan.</p>
            ) : (
              <ul className="space-y-3">
                {visibleFindings.map((finding, index) => (
                  <li
                    key={`${finding.filePath}-${finding.line}-${index}`}
                    className={`rounded-xl border p-4 ${
                      finding.suppressed
                        ? 'border-emerald-500/20 bg-emerald-950/10'
                        : 'border-white/10 bg-zinc-950/60'
                    }`}
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
                        {finding.suppressed ? (
                          <SuppressedFindingBadge suppressionReason={finding.suppressionReason} />
                        ) : (
                          <SecretValidationBadge validation={finding.validation} />
                        )}
                      </div>
                    </div>
                    {finding.suppressed && finding.suppressionReason ? (
                      <p className="mt-2 text-xs text-emerald-300/80">{finding.suppressionReason}</p>
                    ) : null}
                    {!finding.suppressed && finding.validation?.message ? (
                      <p className="mt-2 text-xs text-zinc-400">{finding.validation.message}</p>
                    ) : null}
                    <pre
                      className={`mt-3 overflow-x-auto rounded-lg border px-3 py-2 font-mono text-xs ${
                        finding.suppressed
                          ? 'border-emerald-500/10 bg-zinc-950 text-emerald-200/80'
                          : 'border-white/5 bg-zinc-950 text-rose-300'
                      }`}
                    >
                      {finding.preview}
                    </pre>
                    {!finding.suppressed ? (
                      <button
                        type="button"
                        onClick={() => openAutoFixPreview(finding, index)}
                        className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-300 transition-colors hover:bg-amber-500/20"
                      >
                        <Zap className="h-3.5 w-3.5" />
                        Auto-Fix Preview
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {previewData ? (
        <AutoFixPreviewModal preview={previewData} onClose={() => setPreviewData(null)} />
      ) : null}
    </>
  );
}
