import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, FileText } from 'lucide-react';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { MCPLeaderboardSection } from '@/components/benchmark/MCPLeaderboardSection';
import { getMcpLeaderboardFallback } from '@/lib/mcp-leaderboard';
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
  const leaderboardData = getMcpLeaderboardFallback();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-white/5 bg-zinc-950/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
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

      <main className="mx-auto max-w-6xl px-6 py-16">
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
            <h2 className="text-lg font-semibold text-zinc-100">Evidence Bundle Chain</h2>
            <p className="mt-2 text-sm text-zinc-400">
              Every evaluated action produces a reproducible cryptographic evidence bundle:
            </p>
            <ol className="mt-3 list-inside list-decimal space-y-2 text-sm text-zinc-400">
              <li>Agent Identity — who initiated the runtime session</li>
              <li>Requested Intent — declared user or planner objective</li>
              <li>Tool Call — MCP JSON-RPC method, tool name, and arguments</li>
              <li>Before State Hash — SHA-256 digest of pre-action system state</li>
              <li>After State Hash — post-action digest (or UNVERIFIED if blocked)</li>
              <li>Cryptographic Evidence Bundle — signed, downloadable JSON for audit</li>
            </ol>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-zinc-100">Coverage</h2>
            <ul className="mt-3 list-inside list-disc space-y-2 text-sm text-zinc-400">
              <li>500+ MCP attack scenarios — indirect injection, cross-tool exfil, privilege escalation</li>
              <li>MCP-SEC-SCORE (0–100) composite grade with letter bands A+ through F</li>
              <li>Sub-10ms runtime intercept latency (p50 / p95 / p99)</li>
              <li>UNVERIFIED_ACTION detection when evidence chain breaks</li>
            </ul>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-zinc-100">Reproducibility</h2>
            <p className="mt-3 text-sm text-zinc-400">
              External researchers can reproduce MCP-SEC-SCORE locally — no Nexus Shield account required:
            </p>
            <pre className="mt-3 overflow-x-auto rounded-lg border border-white/10 bg-black/40 p-4 text-xs text-emerald-300">
              {`docker run --rm ghcr.io/baturhantasdelen-sudo/harness:latest --eval-mcp

# 2026 Shadow AI scorecard (Top-10 frameworks):
docker run --rm ghcr.io/baturhantasdelen-sudo/harness:latest --eval-scorecard

# or from source:
git clone ${BENCHMARK_GITHUB_URL}
cd harness && python scripts/run_reproducible_benchmark.py --eval-mcp`}
            </pre>
            <p className="mt-4 text-sm text-zinc-400">
              Full interactive matrix:{' '}
              <Link href="/scorecard" className="text-cyan-400 hover:underline">
                2026 Enterprise AI Agent Security Scorecard
              </Link>
            </p>
            <p className="mt-3 text-sm text-zinc-500">
              Listed on{' '}
              <a href="https://github.com/corca-ai/awesome-llm-security" className="text-cyan-400 hover:underline" target="_blank" rel="noopener noreferrer">
                corca-ai/awesome-llm-security
              </a>{' '}
              and submitted to{' '}
              <a href="https://mcpservers.org/submit" className="text-cyan-400 hover:underline" target="_blank" rel="noopener noreferrer">
                mcpservers.org
              </a>
              .
            </p>
          </section>
        </div>

        <MCPLeaderboardSection initialData={leaderboardData} />

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
