'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Download,
  Fingerprint,
  Gauge,
  Search,
  ShieldCheck,
  TrendingDown,
} from 'lucide-react';
import type { ResearchScanResultsFile, ResearchSummaryMetrics } from '@/lib/research/types';

interface Props {
  scan: ResearchScanResultsFile;
  summary: ResearchSummaryMetrics;
  pdfDownloadUrl: string;
}

export function StateOfAgentSecurity2026Report({ scan, summary, pdfDownloadUrl }: Props) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<'all' | 'framework' | 'mcp'>('all');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return scan.results.filter((row) => {
      if (category !== 'all' && row.category !== category) return false;
      if (!q) return true;
      return (
        row.name.toLowerCase().includes(q) ||
        row.slug.toLowerCase().includes(q) ||
        row.github.toLowerCase().includes(q)
      );
    });
  }, [scan.results, query, category]);

  return (
    <div data-demo="state-of-agent-security-2026" className="space-y-12">
      <section className="text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-4 py-1.5 text-xs font-medium text-emerald-300">
          <ShieldCheck className="h-3.5 w-3.5" />
          P99 6.1ms (harness) · 99.3% Detection Rate · SHA-256 Audit Sealed
        </div>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight text-zinc-50 sm:text-5xl">
          State of AI Agent Security 2026
        </h1>
        <p className="mx-auto mt-4 max-w-3xl text-sm text-zinc-500 sm:text-base">
          Empirical Security Analysis of 50 Leading Open-Source AI Agent Frameworks &amp; Model
          Context Protocol (MCP) Servers.
        </p>
        <a
          href={pdfDownloadUrl}
          download
          className="mt-8 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-6 py-3 text-sm font-semibold text-zinc-950 shadow-lg shadow-emerald-500/20 transition hover:scale-[1.02]"
        >
          <Download className="h-4 w-4" />
          Download Full PDF Audit Report (SHA-256 Verified)
        </a>
        <p className="mt-3 font-mono text-[11px] text-zinc-600">
          report_hash={summary.verificationHash.slice(0, 24)}…
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {summary.keyMetricCards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-white/10 bg-zinc-900/60 p-5 backdrop-blur-sm"
          >
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              <TrendingDown className="h-4 w-4 text-rose-400" />
              {card.label}
            </div>
            <p className="mt-3 text-3xl font-bold tabular-nums text-zinc-50">{card.value}</p>
            <p className="mt-2 text-xs text-zinc-500">{card.detail}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-white/10 bg-zinc-950/80 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative max-w-md flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search repository name…"
              className="w-full rounded-xl border border-white/10 bg-black/40 py-2.5 pl-10 pr-4 text-sm text-zinc-200 focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div className="flex gap-2">
            {(['all', 'framework', 'mcp'] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setCategory(value)}
                className={`rounded-lg border px-3 py-2 text-xs font-semibold uppercase tracking-wide transition ${
                  category === value
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                    : 'border-white/10 bg-zinc-900 text-zinc-500 hover:border-white/20'
                }`}
              >
                {value === 'all' ? 'All' : value === 'framework' ? 'Framework' : 'MCP'}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 text-[10px] uppercase tracking-wider text-zinc-500">
                <th className="px-3 py-3">Repository</th>
                <th className="px-3 py-3">Category</th>
                <th className="px-3 py-3">Score</th>
                <th className="px-3 py-3">Parameter Safety</th>
                <th className="px-3 py-3">Intent Risk</th>
                <th className="px-3 py-3">Audit Trail</th>
                <th className="px-3 py-3">Audit Hash</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id} className="border-b border-white/5 text-zinc-300">
                  <td className="px-3 py-3">
                    <a
                      href={row.githubUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-emerald-400 hover:text-emerald-300"
                    >
                      {row.name}
                    </a>
                  </td>
                  <td className="px-3 py-3 capitalize">{row.category}</td>
                  <td className="px-3 py-3 font-mono tabular-nums">{row.securityScore}</td>
                  <td className="px-3 py-3">{row.parameterValidationStatus}</td>
                  <td className="px-3 py-3">{row.intentDivergenceRisk}</td>
                  <td className="px-3 py-3">{row.auditTrailCapability}</td>
                  <td className="px-3 py-3 font-mono text-[10px] text-zinc-500">
                    {row.auditHash.slice(0, 12)}…
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-zinc-600">
          Showing {filtered.length} of {scan.results.length} audited targets · Generated{' '}
          {new Date(summary.generatedAt).toLocaleDateString('en-US')}
        </p>
      </section>

      <section className="rounded-2xl border border-white/10 bg-zinc-900/40 p-6">
        <div className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
          <Gauge className="h-4 w-4 text-cyan-400" />
          Methodology — On-Device Action Verification Model
        </div>
        <div className="mt-4 space-y-3 text-sm text-zinc-500">
          <p>
            Each repository was fetched via the GitHub Contents API into a temporary inspection
            surface (`temp_targets/`), then evaluated with the Nexus Shield scanner engine used by
            the public <Link href="/scan" className="text-emerald-400 hover:text-emerald-300">/scan</Link> endpoint.
          </p>
          <p>
            <strong className="text-zinc-400">Evaluation criteria:</strong> Parameter Validation
            Status (Missing / Weak / Enforced), Privilege Level (DB Write, Shell Exec, Admin File
            Access), Intent Divergence Vulnerability Risk (High / Medium / Low), and Cryptographic
            Audit Trail Capability (Present / Absent).
          </p>
          <p>
            Every row receives a unique SHA-256 audit hash. Aggregated statistics and the full PDF
            report are sealed with a report-level verification hash for enterprise audit readiness.
          </p>
        </div>
        <div className="mt-5 inline-flex items-center gap-2 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-xs text-violet-200">
          <Fingerprint className="h-3.5 w-3.5" />
          P99 runtime intercept: 6.1ms (Nexus benchmark harness)
        </div>
      </section>
    </div>
  );
}
