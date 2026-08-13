'use client';

import { useState } from 'react';
import { Download, FileCheck2, Loader2, ShieldCheck } from 'lucide-react';

interface ComplianceReportDownloadProps {
  organizationName: string;
  securityGrade: string;
  securityScore: number;
}

export function ComplianceReportDownload({
  organizationName,
  securityGrade,
  securityScore,
}: ComplianceReportDownloadProps) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleDownload() {
    setDownloading(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch('/api/reports/compliance', { method: 'GET' });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? 'Report generation failed');
      }

      const blob = await response.blob();
      const disposition = response.headers.get('Content-Disposition') ?? '';
      const match = disposition.match(/filename="(.+)"/);
      const filename = match?.[1] ?? `nexus-shield-kvkk-compliance-${Date.now()}.pdf`;

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-indigo-500/20 bg-gradient-to-br from-indigo-500/10 via-zinc-900/80 to-fuchsia-500/10 p-6">
      {downloading ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-zinc-950/70 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="relative flex h-16 w-16 items-center justify-center">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400/30" />
              <span className="relative flex h-12 w-12 items-center justify-center rounded-full border border-indigo-400/40 bg-indigo-500/20">
                <Loader2 className="h-6 w-6 animate-spin text-indigo-300" />
              </span>
            </div>
            <p className="text-sm font-medium text-zinc-200">Generating KVKK Compliance Report…</p>
            <p className="text-xs text-zinc-500">Compiling audit data · masking sensitive fields</p>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-300">
            <ShieldCheck className="h-3.5 w-3.5" />
            Enterprise Compliance Export
          </div>
          <div>
            <h2 className="text-xl font-semibold text-zinc-100">KVKK / GDPR Audit Report</h2>
            <p className="mt-1 max-w-2xl text-sm text-zinc-400">
              One-click PDF export for {organizationName} with PII masking statistics, violation risk
              table, and masked secret findings — aligned with KVKK Article 12 and BDDK data security
              guidance.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="rounded-lg border border-white/10 bg-zinc-950/60 px-3 py-1.5 text-zinc-300">
              Security Grade: <strong className="text-indigo-300">{securityGrade}</strong>
            </span>
            <span className="rounded-lg border border-white/10 bg-zinc-950/60 px-3 py-1.5 text-zinc-300">
              Score: <strong className="text-emerald-300">{securityScore}%</strong>
            </span>
          </div>
        </div>

        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          <button
            type="button"
            onClick={() => void handleDownload()}
            disabled={downloading}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:scale-[1.02] disabled:opacity-60"
          >
            {downloading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : success ? (
              <FileCheck2 className="h-4 w-4" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Download KVKK Compliance Report (PDF)
          </button>
          {error ? <p className="text-xs text-rose-400">{error}</p> : null}
          {success ? <p className="text-xs text-emerald-400">Report downloaded successfully.</p> : null}
        </div>
      </div>
    </div>
  );
}
