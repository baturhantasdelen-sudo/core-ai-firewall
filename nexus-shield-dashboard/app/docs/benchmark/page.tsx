import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, FileText } from 'lucide-react';
import { BrandLogo } from '@/components/brand/BrandLogo';
import {
  APP_DOC_ROUTES,
  BENCHMARK_GITHUB_URL,
  getAbsoluteAppUrl,
} from '@/lib/site';

export const metadata: Metadata = {
  title: 'Benchmark Methodology | Nexus Shield',
  description:
    'Open methodology for Nexus Shield agent runtime security benchmarks — 500+ MCP attack scenarios, multi-agent execution graphs, and reproducible harness.',
  alternates: {
    canonical: getAbsoluteAppUrl(APP_DOC_ROUTES.benchmark),
  },
};

export default function BenchmarkMethodologyPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-white/5 bg-zinc-950/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-6 py-4">
          <BrandLogo size={32} />
          <Link
            href={APP_DOC_ROUTES.docs}
            className="inline-flex items-center gap-1.5 text-sm text-zinc-400 transition hover:text-zinc-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to docs
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-16">
        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/5 px-3 py-1 text-xs font-medium text-cyan-300">
          <FileText className="h-3.5 w-3.5" />
          Open Methodology
        </div>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
          Agent Runtime Security Benchmark
        </h1>
        <p className="mt-4 text-base leading-relaxed text-zinc-400">
          Nexus Shield Proof Center metrics are produced by a reproducible open-source harness covering
          parameter hijacking, intent divergence, MCP scope abuse, and multi-agent trajectory violations.
        </p>

        <div className="mt-10 space-y-6 rounded-2xl border border-white/10 bg-zinc-900/50 p-6">
          <section>
            <h2 className="text-lg font-semibold text-zinc-100">Coverage</h2>
            <ul className="mt-3 list-inside list-disc space-y-2 text-sm text-zinc-400">
              <li>500+ MCP attack scenarios across FinTech, SaaS, and enterprise tool chains</li>
              <li>Multi-agent execution graphs with trajectory divergence scoring</li>
              <li>Sub-10ms runtime intercept latency measurement (p50 / p95 / p99)</li>
              <li>SHA-256 evidence bundle generation for every blocked action</li>
            </ul>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-zinc-100">Reproducibility</h2>
            <p className="mt-3 text-sm text-zinc-400">
              Clone the benchmark harness, run against your agent stack, and compare block rates with our
              published Proof Center defaults (127 agents, 48,291 tool calls, 99.3% block rate).
            </p>
          </section>
        </div>

        <a
          href={BENCHMARK_GITHUB_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-8 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500/90 to-emerald-500/90 px-6 py-3 text-sm font-semibold text-zinc-950 transition hover:scale-[1.01]"
        >
          View Open-Source Harness on GitHub
          <ExternalLink className="h-4 w-4" />
        </a>
      </main>
    </div>
  );
}
