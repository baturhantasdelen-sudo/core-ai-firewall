'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  generateAssessmentReport,
  type AssessmentInput,
  type AssessmentReport,
} from '@/lib/assessment/generate-report';

const COMPANY_SIZES = ['1-50', '51-200', '201-1000', '1000+'];

export function AssessmentFunnel({ compact = false }: { compact?: boolean }) {
  const [report, setReport] = useState<AssessmentReport | null>(null);
  const [email, setEmail] = useState('');

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const input: AssessmentInput = {
      workEmail: String(fd.get('workEmail') ?? ''),
      companySize: String(fd.get('companySize') ?? '1-50'),
      agentCount: Number(fd.get('agentCount') ?? 5),
      mcpUsage: fd.get('mcpUsage') === 'on',
      financialActions: fd.get('financialActions') === 'on',
      erpUsage: fd.get('erpUsage') === 'on',
      crmUsage: fd.get('crmUsage') === 'on',
      iamUsage: fd.get('iamUsage') === 'on',
      cloudActions: fd.get('cloudActions') === 'on',
    };
    if (!input.workEmail.includes('@')) return;
    setEmail(input.workEmail);
    setReport(generateAssessmentReport(input));
  }

  return (
    <div className={compact ? '' : 'rounded-2xl border border-white/10 bg-zinc-900/40 p-6 sm:p-8'}>
      {!report ? (
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label htmlFor="workEmail" className="text-xs font-medium text-zinc-400">
              Work email
            </label>
            <input
              id="workEmail"
              name="workEmail"
              type="email"
              required
              autoComplete="email"
              className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
            />
          </div>
          <div>
            <label htmlFor="companySize" className="text-xs font-medium text-zinc-400">
              Company size
            </label>
            <select
              id="companySize"
              name="companySize"
              className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
            >
              {COMPANY_SIZES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="agentCount" className="text-xs font-medium text-zinc-400">
              Approximate number of agents
            </label>
            <input
              id="agentCount"
              name="agentCount"
              type="number"
              min={1}
              max={500}
              defaultValue={10}
              className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
            />
          </div>
          <fieldset className="grid gap-2 text-xs text-zinc-400 sm:grid-cols-2">
            <label className="flex items-center gap-2">
              <input type="checkbox" name="mcpUsage" className="rounded" /> MCP in production
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="financialActions" className="rounded" /> Financial actions
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="erpUsage" className="rounded" /> ERP integrations
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="crmUsage" className="rounded" /> CRM mutations
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="iamUsage" className="rounded" /> IAM / privilege changes
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="cloudActions" className="rounded" /> Cloud infra actions
            </label>
          </fieldset>
          <button
            type="submit"
            className="w-full rounded-lg bg-cyan-600 py-2.5 text-sm font-semibold text-white hover:bg-cyan-500"
          >
            Generate Agent Assurance Report
          </button>
          <p className="text-[10px] text-zinc-500">Report is an ESTIMATE from your inputs — not an environment scan.</p>
        </form>
      ) : (
        <div>
          <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-200">
            {report.label}
          </span>
          <h3 className="mt-3 text-lg font-semibold text-zinc-100">Agent Assurance Report</h3>
          <p className="mt-1 text-xs text-zinc-500">{report.summary}</p>
          <dl className="mt-6 grid gap-3 sm:grid-cols-2">
            {(
              [
                ['Discovered agents', report.discoveredAgents],
                ['High-risk agents', report.highRiskAgents],
                ['Unbounded authority', report.unboundedAuthority],
                ['Critical actions (est.)', report.criticalActions],
                ['Potential false-success cases', report.potentialFalseSuccessCases],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="rounded-lg border border-white/10 bg-zinc-950/60 px-4 py-3">
                <dt className="text-[10px] uppercase tracking-wider text-zinc-500">{k}</dt>
                <dd className="text-2xl font-semibold text-zinc-100">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/#contact" className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white">
              Request technical assessment
            </Link>
            <button
              type="button"
              onClick={() => setReport(null)}
              className="rounded-lg border border-white/15 px-4 py-2 text-sm text-zinc-300"
            >
              Start over
            </button>
          </div>
          {email ? <p className="mt-3 text-[10px] text-zinc-600">Prepared for {email.replace(/(.{2}).+(@.+)/, '$1…$2')}</p> : null}
        </div>
      )}
    </div>
  );
}
