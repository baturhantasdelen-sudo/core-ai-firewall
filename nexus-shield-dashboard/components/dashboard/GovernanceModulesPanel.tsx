'use client';

import { useEffect, useState } from 'react';
import { Activity, RefreshCw, ShieldCheck } from 'lucide-react';
import {
  countVerifiedModules,
  fetchGovernanceStatus,
  GOVERNANCE_MODULE_LABELS,
  GOVERNANCE_MODULE_ORDER,
  moduleVerificationLabel,
  type GovernanceStatusResponse,
  type ModuleStatus,
} from '@/lib/governance/status';

function badgeTone(module: ModuleStatus): string {
  if (module.status === 'VERIFIED' && module.active) {
    return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
  }
  return 'border-rose-500/30 bg-rose-500/10 text-rose-300';
}

export function GovernanceModulesPanel() {
  const [data, setData] = useState<GovernanceStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadStatus() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchGovernanceStatus();
      setData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Governance status unavailable');
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadStatus();
  }, []);

  const verifiedCount = data ? countVerifiedModules(data.modules) : 0;
  const totalModules = GOVERNANCE_MODULE_ORDER.length;

  return (
    <section className="rounded-2xl border border-white/10 bg-zinc-950/60">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
              Enterprise AI Agent Governance &amp; Trust
            </h2>
            <p className="mt-0.5 text-xs text-zinc-500">
              Live operational status for all 13 governance checkpoints
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-200">
            {verifiedCount}/{totalModules} Verified
          </span>
          <button
            type="button"
            onClick={() => void loadStatus()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-zinc-900/60 px-2.5 py-1.5 text-xs text-zinc-300 transition hover:bg-zinc-800 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Yenile
          </button>
        </div>
      </header>

      {error ? (
        <div className="px-5 py-4 text-sm text-rose-300">{error}</div>
      ) : (
        <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {GOVERNANCE_MODULE_ORDER.map((key) => {
            const module = data?.modules[key];
            const label = GOVERNANCE_MODULE_LABELS[key] ?? key;
            const statusLabel = module
              ? moduleVerificationLabel(module.status)
              : '🔴 Doğrulanamadı';

            return (
              <article
                key={key}
                className={`rounded-xl border p-4 ${module ? badgeTone(module) : 'border-rose-500/30 bg-rose-500/10 text-rose-300'}`}
              >
                <p className="text-sm font-medium">{label}</p>
                <p className="mt-2 text-xs font-semibold">{statusLabel}</p>
                {module?.message ? (
                  <p className="mt-2 text-[10px] opacity-80">{module.message}</p>
                ) : null}
              </article>
            );
          })}
        </div>
      )}

      <div className="flex items-start gap-2 border-t border-white/5 px-5 py-3 text-xs text-zinc-500">
        <Activity className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
        {data?.timestamp
          ? `Last sync: ${new Date(data.timestamp).toLocaleString()}`
          : 'Awaiting live backend sync from /api/governance/status'}
      </div>
    </section>
  );
}
