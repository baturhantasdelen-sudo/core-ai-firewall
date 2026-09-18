import Link from 'next/link';
import { ArrowLeft, ScanSearch, ShieldCheck } from 'lucide-react';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { FreeAgentScanPanel } from '@/components/scan/FreeAgentScanPanel';

export const metadata = {
  title: 'Free AI Agent & MCP Security Scan | Nexus Shield',
  description:
    'Scan agent API endpoints, MCP configs, or GitHub repos for excessive authority, missing intent verification, tool misuse, and evidence chain gaps.',
};

export default function ScanPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-white/5 bg-zinc-950/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
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

      <main className="mx-auto max-w-5xl px-6 py-12">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-4 py-1.5 text-xs font-medium text-emerald-300">
            <ScanSearch className="h-3.5 w-3.5" />
            Free Assessment — No API Key Required
          </div>
          <h1 className="mt-6 text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
            FREE AI AGENT &amp; MCP SECURITY SCAN
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm text-zinc-500 sm:text-base">
            Attack → Prove → Install → Protect. Discover excessive authority, unsigned actions, missing intent
            verification, tool misuse, and evidence chain gaps before production deployment.
          </p>
        </div>

        <div className="mt-10">
          <FreeAgentScanPanel />
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-3">
          {[
            {
              title: '1. Attack',
              body: 'Run the free scan or interactive attack simulator on your agent surface.',
            },
            {
              title: '2. Prove',
              body: 'Download a shareable security report with severity badges and Agent Security Score.',
            },
            {
              title: '3. Install & Protect',
              body: 'Fix findings with the Nexus Shield SDK — sub-10ms runtime interception.',
            },
          ].map(({ title, body }) => (
            <div key={title} className="rounded-xl border border-white/10 bg-zinc-900/40 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-emerald-300">
                <ShieldCheck className="h-4 w-4" />
                {title}
              </div>
              <p className="mt-2 text-xs text-zinc-500">{body}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
