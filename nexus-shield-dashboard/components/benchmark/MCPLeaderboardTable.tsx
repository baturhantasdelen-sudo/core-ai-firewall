'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Download,
  Filter,
  Loader2,
  Search,
  Share2,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import {
  fetchMcpLeaderboard,
  getMcpLeaderboardFallback,
  gradeAccentClass,
} from '@/lib/mcp-leaderboard';
import { OwaspTagList } from '@/components/benchmark/OwaspComplianceSection';
import { APP_DOC_ROUTES, getAbsoluteAppUrl } from '@/lib/site';
import type { McpHarnessGrade, McpLeaderboardAdapter, McpLeaderboardView } from '@/types/mcp-leaderboard';

const GRADES: McpHarnessGrade[] = ['A+', 'A', 'B', 'C', 'D', 'F'];

function GradeBadge({ grade }: { grade: McpHarnessGrade }) {
  return (
    <span
      className={`inline-flex min-w-[2.5rem] items-center justify-center rounded-md border px-2 py-0.5 text-xs font-bold ${gradeAccentClass(grade)}`}
    >
      {grade}
    </span>
  );
}

function ProtectionBadge({ status }: { status: McpLeaderboardAdapter['protection_status'] }) {
  if (status === 'protected') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-300">
        <ShieldCheck className="h-3.5 w-3.5" />
        Protected
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-xs font-medium text-rose-300">
      <ShieldAlert className="h-3.5 w-3.5" />
      Vulnerable OOTB
    </span>
  );
}

function AdapterRow({
  adapter,
  expanded,
  onToggle,
}: {
  adapter: McpLeaderboardAdapter;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr
        className="cursor-pointer border-b border-white/5 transition hover:bg-zinc-900/60"
        onClick={onToggle}
      >
        <td className="px-4 py-4">
          <div className="flex items-center gap-2">
            {expanded ? (
              <ChevronDown className="h-4 w-4 text-zinc-500" />
            ) : (
              <ChevronRight className="h-4 w-4 text-zinc-500" />
            )}
            <span className="font-mono text-sm text-cyan-200">{adapter.adapter_name}</span>
          </div>
        </td>
        <td className="px-4 py-4 text-sm text-zinc-400">
          {adapter.target_vectors.join(' · ')}
        </td>
        <td className="px-4 py-4 text-sm text-zinc-300">
          {adapter.vulnerabilities_detected.length} detected
        </td>
        <td className="px-4 py-4">
          <GradeBadge grade={adapter.grade} />
        </td>
        <td className="px-4 py-4">
          <ProtectionBadge status={adapter.protection_status} />
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-white/5 bg-zinc-950/80">
          <td colSpan={5} className="px-4 py-4">
            <div className="space-y-3">
              {adapter.scenarios.map((scenario) => (
                <article
                  key={scenario.scenario_id}
                  className="rounded-xl border border-white/10 bg-zinc-900/50 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-sm font-semibold text-zinc-100">{scenario.scenario_name}</h4>
                    <div className="flex items-center gap-2">
                      <GradeBadge grade={scenario.grade} />
                      <span className="text-xs text-zinc-500">{scenario.verdict}</span>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-zinc-500">
                    Expected: runtime guard blocks hijacked JSON-RPC{' '}
                    <code className="text-zinc-400">{scenario.tool_calls?.[0]?.tool ?? 'tool'}</code>{' '}
                    call · Actual:{' '}
                    <span className={scenario.blocked ? 'text-emerald-400' : 'text-rose-400'}>
                      {scenario.blocked ? 'BLOCKED' : 'EXECUTED'}
                    </span>
                  </p>
                  <pre className="mt-3 overflow-x-auto rounded-lg bg-zinc-950 p-3 text-xs text-zinc-400">
                    {JSON.stringify(scenario.tool_calls?.[0] ?? {}, null, 2)}
                  </pre>
                  {scenario.owasp ? (
                    <OwaspTagList
                      genai={scenario.owasp.owasp_genai_top_10}
                      agentic={scenario.owasp.owasp_agentic}
                    />
                  ) : null}
                  <p className="mt-2 font-mono text-[10px] text-zinc-600">
                    evidence: {scenario.evidence_hash.slice(0, 16)}…
                  </p>
                </article>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export function MCPLeaderboardTable({
  initialData,
}: {
  initialData?: McpLeaderboardView;
}) {
  const [data, setData] = useState<McpLeaderboardView>(initialData ?? getMcpLeaderboardFallback());
  const [loading, setLoading] = useState(!initialData);
  const [search, setSearch] = useState('');
  const [gradeFilter, setGradeFilter] = useState<McpHarnessGrade | 'ALL'>('ALL');
  const [expandedAdapter, setExpandedAdapter] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) return;
    void fetchMcpLeaderboard().then((payload) => {
      setData(payload);
      setLoading(false);
    });
  }, [initialData]);

  const filteredAdapters = useMemo(() => {
    return data.adapters.filter((adapter) => {
      const matchesSearch =
        search.trim() === '' ||
        adapter.adapter_name.toLowerCase().includes(search.toLowerCase()) ||
        adapter.target_vectors.some((vector) =>
          vector.toLowerCase().includes(search.toLowerCase()),
        );
      const matchesGrade = gradeFilter === 'ALL' || adapter.grade === gradeFilter;
      return matchesSearch && matchesGrade;
    });
  }, [data.adapters, search, gradeFilter]);

  const shareUrl = getAbsoluteAppUrl(APP_DOC_ROUTES.benchmark);
  const shareText = encodeURIComponent(
    `Nexus Shield MCP Tool-Hijack Leaderboard — MCP-SEC-SCORE ${data.mcp_sec_score} (${data.grade}) with ${data.blocked_rate}% block rate.`,
  );

  function downloadJson() {
    const blob = new Blob([JSON.stringify(data.raw, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'mcp_leaderboard.json';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const heroAccent = gradeAccentClass(data.grade);

  return (
    <section className="mt-12 min-h-[720px]">
      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900/80 via-zinc-950 to-zinc-900/60 p-6 sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-cyan-400/80">
              MCP Tool-Hijack Security Leaderboard
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-zinc-50 sm:text-3xl">
              Great MCP Tool-Hijack Benchmark
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-zinc-400">
              Live harness results from indirect prompt injection, cross-tool exfiltration, and
              privilege escalation scenarios across production MCP adapters.
            </p>
          </div>
          <div
            className={`flex min-w-[220px] flex-col items-center rounded-2xl border bg-gradient-to-br p-5 ${heroAccent}`}
          >
            <span className="text-xs font-medium uppercase tracking-wider opacity-80">
              MCP-SEC-SCORE
            </span>
            <span className="mt-1 text-4xl font-bold tabular-nums">{data.mcp_sec_score}</span>
            <GradeBadge grade={data.grade} />
            {loading && <Loader2 className="mt-2 h-4 w-4 animate-spin opacity-70" />}
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
            <p className="text-xs text-zinc-500">Block Rate</p>
            <p className="text-xl font-semibold text-emerald-300">
              {data.blocked_rate}%{' '}
              <span className="text-sm font-normal text-emerald-400/80">
                ({data.blocked_count}/{data.scenarios_evaluated} blocked)
              </span>
            </p>
          </div>
          <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 px-4 py-3">
            <p className="text-xs text-zinc-500">Scenarios Evaluated</p>
            <p className="text-xl font-semibold text-cyan-200">{data.scenarios_evaluated}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-zinc-900/50 px-4 py-3">
            <p className="text-xs text-zinc-500">Proof Center Baseline</p>
            <p className="text-xl font-semibold text-zinc-100">
              {data.meets_baseline ? 'Meets 99.3%' : 'Below baseline'}
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row">
            <label className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                type="search"
                placeholder="Filter by adapter or attack vector…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-zinc-950/80 py-2.5 pl-10 pr-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-cyan-500/40 focus:outline-none"
              />
            </label>
            <label className="relative sm:w-40">
              <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <select
                value={gradeFilter}
                onChange={(event) => setGradeFilter(event.target.value as McpHarnessGrade | 'ALL')}
                className="w-full appearance-none rounded-xl border border-white/10 bg-zinc-950/80 py-2.5 pl-10 pr-3 text-sm text-zinc-200 focus:border-cyan-500/40 focus:outline-none"
              >
                <option value="ALL">All grades</option>
                {GRADES.map((grade) => (
                  <option key={grade} value={grade}>
                    Grade {grade}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={downloadJson}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-zinc-900/80 px-4 py-2.5 text-sm font-medium text-zinc-200 transition hover:border-cyan-500/30 hover:text-cyan-200"
            >
              <Download className="h-4 w-4" />
              Download Raw JSON
            </button>
            <a
              href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-zinc-900/80 px-4 py-2.5 text-sm font-medium text-zinc-200 transition hover:border-cyan-500/30"
            >
              <Share2 className="h-4 w-4" />
              LinkedIn
            </a>
            <a
              href={`https://twitter.com/intent/tweet?text=${shareText}&url=${encodeURIComponent(shareUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-zinc-900/80 px-4 py-2.5 text-sm font-medium text-zinc-200 transition hover:border-cyan-500/30"
            >
              <Share2 className="h-4 w-4" />
              Post on X
            </a>
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-xl border border-white/10">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left">
              <thead className="bg-zinc-950/80 text-xs uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Target MCP Adapter</th>
                  <th className="px-4 py-3 font-semibold">Attack Vectors</th>
                  <th className="px-4 py-3 font-semibold">Vulnerabilities</th>
                  <th className="px-4 py-3 font-semibold">Grade</th>
                  <th className="px-4 py-3 font-semibold">Nexus Shield Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredAdapters.map((adapter) => (
                  <AdapterRow
                    key={adapter.adapter_name}
                    adapter={adapter}
                    expanded={expandedAdapter === adapter.adapter_name}
                    onToggle={() =>
                      setExpandedAdapter((current) =>
                        current === adapter.adapter_name ? null : adapter.adapter_name,
                      )
                    }
                  />
                ))}
              </tbody>
            </table>
          </div>
          {filteredAdapters.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-zinc-500">
              No adapters match your filters.
            </p>
          )}
        </div>

        <p className="mt-4 text-xs text-zinc-600">
          Last updated {data.timestamp_utc} · Open-source harness:{' '}
          <a
            href="https://github.com/baturhantasdelen-sudo/harness"
            className="text-cyan-500/80 hover:text-cyan-400"
            target="_blank"
            rel="noopener noreferrer"
          >
            baturhantasdelen-sudo/harness
          </a>
        </p>
      </div>
    </section>
  );
}
