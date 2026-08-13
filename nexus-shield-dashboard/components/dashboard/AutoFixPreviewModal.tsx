'use client';

import { X, Zap } from 'lucide-react';
import type { RemediationFix } from '@/lib/engine/remediation';

export interface AutoFixPreviewData {
  type: string;
  ruleId: string;
  category: 'secret' | 'pii';
  line: number;
  column: number;
  matched: string;
  originalLine: string;
  fixedLine: string;
  diff: string;
  envExampleLine?: string | null;
}

interface AutoFixPreviewModalProps {
  preview: AutoFixPreviewData;
  onClose: () => void;
}

export function AutoFixPreviewModal({ preview, onClose }: AutoFixPreviewModalProps) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-white/10 bg-zinc-900 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-white/10 p-6">
          <div>
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-400" />
              <h3 className="text-lg font-semibold text-zinc-100">Auto-Fix Preview</h3>
            </div>
            <p className="mt-1 text-sm text-zinc-400">
              {preview.type} · line {preview.line}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-200"
            aria-label="Close auto-fix preview"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        <div className="space-y-4 p-6">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
              Before
            </p>
            <pre className="overflow-x-auto rounded-lg border border-rose-500/20 bg-rose-950/20 px-4 py-3 font-mono text-sm text-rose-200">
              {preview.originalLine}
            </pre>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
              After (Nexus Shield remediation)
            </p>
            <pre className="overflow-x-auto rounded-lg border border-emerald-500/20 bg-emerald-950/20 px-4 py-3 font-mono text-sm text-emerald-200">
              {preview.fixedLine}
            </pre>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">Diff</p>
            <pre className="overflow-x-auto rounded-lg border border-white/10 bg-zinc-950 px-4 py-3 font-mono text-xs leading-relaxed text-zinc-300">
              {preview.diff.split('\n').map((line, index) => (
                <span
                  key={`${line}-${index}`}
                  className={
                    line.startsWith('-')
                      ? 'block text-rose-300'
                      : line.startsWith('+')
                        ? 'block text-emerald-300'
                        : 'block'
                  }
                >
                  {line}
                </span>
              ))}
            </pre>
          </div>

          {preview.envExampleLine ? (
            <div className="rounded-xl border border-amber-500/20 bg-amber-950/20 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-amber-400">
                Suggested .env.example entry
              </p>
              <pre className="mt-2 font-mono text-sm text-amber-100">{preview.envExampleLine}</pre>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function fixToPreviewData(
  fix: RemediationFix,
  originalLine: string,
  fixedLine: string,
  diff: string,
): AutoFixPreviewData {
  return {
    type: fix.type,
    ruleId: fix.ruleId,
    category: fix.category,
    line: fix.line,
    column: fix.column,
    matched: fix.original,
    originalLine,
    fixedLine,
    diff,
    envExampleLine: fix.envExampleLine ?? null,
  };
}
