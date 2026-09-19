import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { StateOfAgentSecurity2026Report } from '@/components/reports/StateOfAgentSecurity2026Report';
import { getResearchReportPdfUrl } from '@/lib/config';
import { loadReportBundle2026 } from '@/lib/research/load-report-data';

export const metadata = {
  title: 'State of AI Agent Security 2026',
  description:
    'Empirical security analysis of 50 open-source AI agent frameworks and MCP servers — parameter validation, privilege levels, intent divergence, and SHA-256 audit trails.',
};

export default async function StateOfAgentSecurity2026Page() {
  const bundle = await loadReportBundle2026();
  const pdfDownloadUrl = getResearchReportPdfUrl();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-white/5 bg-zinc-950/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <BrandLogo size={32} />
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-zinc-400 transition hover:text-zinc-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-12">
        {bundle.source === 'fallback' ? (
          <p className="mb-6 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-center text-xs text-amber-200">
            Showing preview dataset — run{' '}
            <code className="text-amber-100">npm run research:pipeline</code> to refresh live scan
            results.
          </p>
        ) : null}
        <StateOfAgentSecurity2026Report
          scan={bundle.scan}
          summary={bundle.summary}
          pdfDownloadUrl={pdfDownloadUrl}
        />
      </main>
    </div>
  );
}
