'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  Download,
  FolderGit2,
  Globe,
  Loader2,
  ScanSearch,
  Server,
  Share2,
  ShieldCheck,
} from 'lucide-react';
import type { AgentSecurityReport, FindingSeverity, ScanInputType } from '@/lib/scanner';

const INPUT_TABS: Array<{ id: ScanInputType; label: string; icon: typeof Globe; placeholder: string }> = [
  {
    id: 'endpoint',
    label: 'Agent API Endpoint',
    icon: Server,
    placeholder: 'https://api.myagent.com/v1/chat/completions',
  },
  {
    id: 'mcp',
    label: 'MCP Config JSON',
    icon: Globe,
    placeholder: 'Paste mcp.json or Cursor/Claude MCP server configuration…',
  },
  {
    id: 'github',
    label: 'GitHub Repository',
    icon: FolderGit2,
    placeholder: 'https://github.com/org/my-ai-agent',
  },
];

const SEVERITY_STYLES: Record<FindingSeverity, string> = {
  critical: 'border-rose-500/40 bg-rose-500/10 text-rose-300',
  high: 'border-orange-500/40 bg-orange-500/10 text-orange-300',
  medium: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  low: 'border-zinc-500/40 bg-zinc-500/10 text-zinc-300',
};

const EXAMPLE_MCP = `{
  "mcpServers": {
    "filesystem": { "command": "npx", "args": ["-y", "@modelcontextprotocol/server-filesystem"] },
    "shell": { "command": "bash", "args": ["-c", "run_command"] }
  }
}`;

function scoreColor(score: number): string {
  if (score >= 75) return 'text-emerald-400';
  if (score >= 50) return 'text-amber-400';
  return 'text-rose-400';
}

export function FreeAgentScanPanel() {
  const [inputType, setInputType] = useState<ScanInputType>('endpoint');
  const [target, setTarget] = useState('');
  const [mcpConfig, setMcpConfig] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<AgentSecurityReport | null>(null);

  const activeTab = INPUT_TABS.find((t) => t.id === inputType)!;

  const runScan = useCallback(async () => {
    const value = inputType === 'mcp' ? mcpConfig.trim() || target.trim() : target.trim();
    if (!value) {
      setError('Enter a target to scan.');
      return;
    }

    setLoading(true);
    setError(null);
    setReport(null);

    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputType,
          target: inputType === 'mcp' ? 'mcp-config' : value,
          mcpConfig: inputType === 'mcp' ? value : undefined,
        }),
      });

      const data = (await res.json()) as AgentSecurityReport & { error?: string; detail?: string };

      if (!res.ok) {
        setError(data.detail ?? data.error ?? 'Scan request failed.');
        return;
      }

      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }, [inputType, target, mcpConfig]);

  const downloadReport = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `nexus-agent-security-report-${Date.now()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const shareReport = async () => {
    if (!report) return;
    const text = `AI Agent Security Score: ${report.score}/100 (${report.grade}) — scanned with Nexus Shield`;
    if (navigator.share) {
      await navigator.share({ title: 'Nexus Shield Agent Security Report', text, url: window.location.href });
    } else {
      await navigator.clipboard.writeText(text);
    }
  };

  return (
    <div className="mx-auto max-w-5xl">
      <div className="overflow-hidden rounded-2xl border border-emerald-500/20 bg-zinc-900/60 shadow-xl shadow-emerald-500/5">
        <div className="border-b border-white/10 bg-zinc-900/80 p-5">
          <div className="flex flex-wrap gap-2">
            {INPUT_TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setInputType(id)}
                className={`inline-flex select-none cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                  inputType === id
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                    : 'border-white/10 bg-zinc-800/80 text-zinc-400 hover:border-white/20'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4 p-5">
          {inputType !== 'mcp' ? (
            <div>
              <label htmlFor="scan-target" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-500">
                {activeTab.label}
              </label>
              <input
                id="scan-target"
                type="url"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder={activeTab.placeholder}
                className="w-full rounded-xl border border-white/10 bg-zinc-950 px-4 py-3 font-mono text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
              />
            </div>
          ) : (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label htmlFor="mcp-config" className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  MCP Config JSON
                </label>
                <button
                  type="button"
                  onClick={() => setMcpConfig(EXAMPLE_MCP)}
                  className="text-xs text-emerald-400 hover:text-emerald-300"
                >
                  Load example
                </button>
              </div>
              <textarea
                id="mcp-config"
                value={mcpConfig}
                onChange={(e) => setMcpConfig(e.target.value)}
                rows={8}
                placeholder={activeTab.placeholder}
                className="w-full resize-y rounded-xl border border-white/10 bg-zinc-950 px-4 py-3 font-mono text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
              />
            </div>
          )}

          {error ? (
            <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => void runScan()}
            disabled={loading}
            className="inline-flex w-full select-none cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 py-3.5 text-sm font-semibold text-zinc-950 shadow-lg shadow-emerald-500/25 transition hover:scale-[1.01] disabled:opacity-60 sm:w-auto sm:px-8"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanSearch className="h-4 w-4" />}
            Run Free Security Scan
          </button>
        </div>
      </div>

      {report ? (
        <div className="mt-8 overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/60">
          <div className="border-b border-white/10 bg-zinc-900/80 p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-400">
                  AI Agent Security Report
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-zinc-50">Agent Security Score</h2>
                <p className="mt-1 font-mono text-xs text-zinc-500">{report.target}</p>
              </div>
              <div className="text-right">
                <div className={`text-5xl font-bold tabular-nums ${scoreColor(report.score)}`}>
                  {report.score}
                  <span className="text-2xl text-zinc-500">/100</span>
                </div>
                <div className="mt-1 text-sm font-semibold text-zinc-400">Grade {report.grade}</div>
                <div className="mt-1 text-xs text-zinc-600">{report.latencyMs}ms analysis</div>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {(['critical', 'high', 'medium', 'low'] as FindingSeverity[]).map((sev) =>
                report.summary[sev] > 0 ? (
                  <span
                    key={sev}
                    className={`rounded-full border px-3 py-1 text-xs font-bold uppercase ${SEVERITY_STYLES[sev]}`}
                  >
                    {sev}: {report.summary[sev]}
                  </span>
                ) : null,
              )}
            </div>
          </div>

          <div className="grid gap-3 border-b border-white/10 p-5 sm:grid-cols-4">
            {[
              { label: 'Tools detected', value: report.attackSurface.toolsDetected },
              { label: 'Unsigned actions', value: report.attackSurface.unsignedActions },
              {
                label: 'Intent verification',
                value: report.attackSurface.intentVerificationPresent ? 'Present' : 'Missing',
              },
              {
                label: 'Evidence chain',
                value: report.attackSurface.evidenceChainPresent ? 'Present' : 'Missing',
              },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-xl border border-white/10 bg-zinc-950/60 p-3 text-center">
                <div className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</div>
                <div className="mt-1 text-sm font-semibold text-zinc-200">{value}</div>
              </div>
            ))}
          </div>

          <ul className="divide-y divide-white/5 p-5">
            {report.findings.map((finding) => (
              <li key={finding.id} className="py-4 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[10px] text-zinc-600">{finding.id}</span>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${SEVERITY_STYLES[finding.severity]}`}
                      >
                        {finding.severity}
                      </span>
                    </div>
                    <h3 className="mt-1 text-sm font-semibold text-zinc-100">{finding.title}</h3>
                    <p className="mt-1 text-sm text-zinc-400">{finding.description}</p>
                    <p className="mt-2 text-xs text-zinc-500">
                      <strong className="text-zinc-400">Fix:</strong> {finding.recommendation}
                    </p>
                    {finding.sdkFix ? (
                      <code className="mt-2 block rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 font-mono text-[11px] text-emerald-300/90">
                        {finding.sdkFix}
                      </code>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-zinc-950/40 p-5">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={downloadReport}
                className="inline-flex select-none cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-zinc-800 px-3 py-2 text-xs font-medium text-zinc-200 hover:border-white/20"
              >
                <Download className="h-3.5 w-3.5" />
                Download JSON Report
              </button>
              <button
                type="button"
                onClick={() => void shareReport()}
                className="inline-flex select-none cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-zinc-800 px-3 py-2 text-xs font-medium text-zinc-200 hover:border-white/20"
              >
                <Share2 className="h-3.5 w-3.5" />
                Share Score
              </button>
            </div>
            <Link
              href="/docs"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:scale-[1.02]"
            >
              <ShieldCheck className="h-4 w-4" />
              Fix with Nexus Shield SDK
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
