'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import {
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileJson,
  FileText,
  ShieldAlert,
} from 'lucide-react';
import {
  evaluateAllFrameworks,
  exportSignedAuditBundle,
  generateAuditReport,
  verifyAuditReportSignature,
  type AuditControl,
  type ComplianceEvaluation,
  type ComplianceFramework,
  type ComplianceReport,
} from '@/lib/compliance';

const FRAMEWORK_LABELS: Record<ComplianceFramework, string> = {
  SOC2_TYPE2: 'SOC 2 Type II',
  ISO_42001: 'ISO/IEC 42001',
  EU_AI_ACT: 'EU AI Act',
};

function scoreTone(score: number): string {
  if (score >= 85) return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200';
  if (score >= 70) return 'border-cyan-500/30 bg-cyan-500/10 text-cyan-200';
  if (score >= 55) return 'border-amber-500/30 bg-amber-500/10 text-amber-200';
  return 'border-rose-500/40 bg-rose-500/15 text-rose-200';
}

function scoreBarTone(score: number): string {
  if (score >= 85) return 'bg-emerald-500';
  if (score >= 70) return 'bg-cyan-500';
  if (score >= 55) return 'bg-amber-500';
  return 'bg-rose-500';
}

function controlStatusTone(status: AuditControl['status']): string {
  return status === 'PASSED'
    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
    : 'border-amber-500/30 bg-amber-500/10 text-amber-200';
}

function downloadBlob(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function AuditCompliancePanel() {
  const [evaluations, setEvaluations] = useState<ComplianceEvaluation[]>([]);
  const [activeFramework, setActiveFramework] = useState<ComplianceFramework>('SOC2_TYPE2');
  const [latestReport, setLatestReport] = useState<ComplianceReport | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setEvaluations(evaluateAllFrameworks());
  }, []);

  const activeEvaluation = useMemo(
    () => evaluations.find((evaluation) => evaluation.framework === activeFramework),
    [evaluations, activeFramework],
  );

  function handleGenerateReport(framework: ComplianceFramework) {
    startTransition(() => {
      const report = generateAuditReport(framework);
      const valid = verifyAuditReportSignature(report);
      setActiveFramework(framework);
      setLatestReport(report);
      setStatusMessage(
        valid
          ? `${FRAMEWORK_LABELS[framework]} report generated — ${report.complianceScore}% compliance`
          : 'Report signature verification failed',
      );
      setEvaluations(evaluateAllFrameworks());
    });
  }

  function handleExport(format: 'JSON' | 'PDF') {
    if (!latestReport) {
      setStatusMessage('Generate a report first before exporting');
      return;
    }

    startTransition(() => {
      const bundle = exportSignedAuditBundle(latestReport, format);

      if (format === 'JSON') {
        downloadBlob(
          `${latestReport.reportId}-audit-bundle.json`,
          JSON.stringify(bundle, null, 2),
          'application/json',
        );
      } else {
        const pdfContent = [
          'NEXUS SHIELD — SIGNED AUDIT BUNDLE (PDF SIMULATION)',
          `Report ID: ${latestReport.reportId}`,
          `Framework: ${FRAMEWORK_LABELS[latestReport.framework]}`,
          `Compliance Score: ${latestReport.complianceScore}%`,
          `Report Hash: ${latestReport.reportHash}`,
          `Bundle Hash: ${bundle.bundleHash}`,
          `Signature: ${latestReport.cryptographicSignature.slice(0, 32)}…`,
          '',
          latestReport.auditorSummary,
        ].join('\n');

        downloadBlob(`${latestReport.reportId}-audit-bundle.pdf.txt`, pdfContent, 'text/plain');
      }

      setStatusMessage(`Exported signed ${format} audit bundle — hash ${bundle.bundleHash.slice(0, 16)}…`);
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-500">
            Enterprise Compliance &amp; Automated Audit Reports
          </h2>
          <p className="mt-1 text-xs text-zinc-600">
            P3 Sprint 21-22 — SOC2 · ISO 42001 · EU AI Act · signed audit bundles
          </p>
        </div>
        {activeEvaluation ? (
          <div className={`rounded-xl border px-4 py-3 ${scoreTone(activeEvaluation.complianceScore)}`}>
            <p className="text-[10px] font-semibold uppercase tracking-wider opacity-70">
              {FRAMEWORK_LABELS[activeFramework]} Score
            </p>
            <p className="mt-1 text-2xl font-bold">{activeEvaluation.complianceScore}%</p>
          </div>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {evaluations.map((evaluation) => (
          <button
            key={evaluation.framework}
            type="button"
            onClick={() => setActiveFramework(evaluation.framework)}
            className={`rounded-xl border p-4 text-left transition ${
              activeFramework === evaluation.framework
                ? 'border-sky-500/40 bg-sky-500/10'
                : 'border-white/10 bg-zinc-900/50 hover:border-white/20'
            }`}
          >
            <p className="text-xs font-semibold text-zinc-200">{FRAMEWORK_LABELS[evaluation.framework]}</p>
            <p className="mt-2 text-2xl font-bold text-zinc-50">{evaluation.complianceScore}%</p>
            <p className="mt-1 text-[10px] text-zinc-500">
              {evaluation.passedCount} passed · {evaluation.actionRequiredCount} action required
            </p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-800">
              <div
                className={`h-full rounded-full ${scoreBarTone(evaluation.complianceScore)}`}
                style={{ width: `${evaluation.complianceScore}%` }}
              />
            </div>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => handleGenerateReport('SOC2_TYPE2')}
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-2 text-xs font-semibold text-sky-200 transition hover:bg-sky-500/20 disabled:opacity-50"
        >
          <ClipboardCheck className="h-3.5 w-3.5" />
          Generate SOC2 Report
        </button>
        <button
          type="button"
          onClick={() => handleGenerateReport('ISO_42001')}
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-xl border border-violet-500/30 bg-violet-500/10 px-4 py-2 text-xs font-semibold text-violet-200 transition hover:bg-violet-500/20 disabled:opacity-50"
        >
          <FileText className="h-3.5 w-3.5" />
          Generate ISO 42001 Package
        </button>
        <button
          type="button"
          onClick={() => handleExport('JSON')}
          disabled={isPending || !latestReport}
          className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/20 disabled:opacity-50"
        >
          <FileJson className="h-3.5 w-3.5" />
          Export Signed Audit Bundle (JSON)
        </button>
        <button
          type="button"
          onClick={() => handleExport('PDF')}
          disabled={isPending || !latestReport}
          className="inline-flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs font-semibold text-amber-200 transition hover:bg-amber-500/20 disabled:opacity-50"
        >
          <Download className="h-3.5 w-3.5" />
          Export Signed Audit Bundle (PDF)
        </button>
      </div>

      {statusMessage ? (
        <p className="rounded-lg border border-white/10 bg-zinc-900/60 px-4 py-2 text-xs text-zinc-300">
          {statusMessage}
        </p>
      ) : null}

      {activeEvaluation ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-white/10 bg-zinc-900/50 p-5">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Audit Controls — {FRAMEWORK_LABELS[activeEvaluation.framework]}
            </p>
            <div className="space-y-2">
              {activeEvaluation.controls.map((control) => (
                <div
                  key={control.controlId}
                  className="rounded-xl border border-white/10 bg-zinc-950/40 p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-medium text-zinc-200">{control.title}</p>
                      <p className="mt-0.5 font-mono text-[10px] text-zinc-500">{control.controlId}</p>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${controlStatusTone(control.status)}`}
                    >
                      {control.status === 'PASSED' ? (
                        <CheckCircle2 className="h-3 w-3" />
                      ) : (
                        <ShieldAlert className="h-3 w-3" />
                      )}
                      {control.status.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="mt-2 text-[11px] text-zinc-400">{control.evidence}</p>
                  <p className="mt-1 text-[10px] text-zinc-600">Control score {control.score}/100</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-zinc-900/50 p-5">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Auditor Summary
            </p>
            {latestReport && latestReport.framework === activeFramework ? (
              <div className="space-y-3">
                <p className="text-sm leading-relaxed text-zinc-300">{latestReport.auditorSummary}</p>
                <div className="rounded-lg border border-white/5 bg-zinc-950/40 p-3 font-mono text-[10px] text-zinc-500">
                  <p>reportId: {latestReport.reportId}</p>
                  <p>hash: {latestReport.reportHash.slice(0, 32)}…</p>
                  <p>signature: {latestReport.cryptographicSignature.slice(0, 32)}…</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-zinc-500">
                Generate a report to view the auditor summary and cryptographic proof bundle metadata.
              </p>
            )}

            <div className="mt-4 grid grid-cols-2 gap-2 text-[10px]">
              <Metric label="Evidence Verified" value={`${activeEvaluation.metrics.evidenceVerificationRate}%`} />
              <Metric label="Red Team Resilience" value={`${activeEvaluation.metrics.redTeamResilienceScore}`} />
              <Metric label="JIT Revocations" value={`${activeEvaluation.metrics.jitRevocationCount}`} />
              <Metric label="Avg Reputation" value={`${activeEvaluation.metrics.avgReputationScore}`} />
              <Metric label="Threat IOCs" value={`${activeEvaluation.metrics.threatIntelIocCount}`} />
              <Metric label="Poison Incidents" value={`${activeEvaluation.metrics.memoryPoisonIncidents}`} />
            </div>
          </section>
        </div>
      ) : null}
    </div>
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
