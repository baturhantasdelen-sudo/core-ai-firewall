import { ExternalLink, ShieldCheck } from 'lucide-react';
import { OWASP_REFERENCES, OWASP_STANDARDS_ALIGNMENT, RUNTIME_PRIVACY_METADATA } from '@/lib/owasp/threat-mapping';

export function OwaspComplianceSection() {
  return (
    <section className="mt-10 space-y-6 rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-500/5 via-zinc-900/60 to-zinc-950/80 p-6 backdrop-blur-md">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-violet-200">
            <ShieldCheck className="h-3.5 w-3.5" />
            OWASP Compliance &amp; Standards Alignment
          </div>
          <h2 className="mt-3 text-lg font-semibold text-zinc-100">
            Mapped to OWASP GenAI Top 10 &amp; Agentic AI Threats
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-zinc-400">
            Every intercepted MCP hijack scenario in this leaderboard carries dynamic{' '}
            <code className="text-violet-200">owasp_genai_top_10</code> and{' '}
            <code className="text-violet-200">owasp_agentic</code> tags (e.g. LLM01 Prompt Injection,
            ASI-01 Agent Goal Hijacking, ASI-02 Cross-Tool Leakage) for CISO-ready audit exports.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-zinc-950/50 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Frameworks</p>
          <ul className="mt-2 space-y-1 text-sm text-zinc-300">
            {OWASP_STANDARDS_ALIGNMENT.frameworks.map((name) => (
              <li key={name}>• {name}</li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-zinc-500">{OWASP_STANDARDS_ALIGNMENT.compliance_note}</p>
        </div>
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400/80">
            On-device privacy model
          </p>
          <p className="mt-2 text-sm text-zinc-300">{RUNTIME_PRIVACY_METADATA.description}</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {RUNTIME_PRIVACY_METADATA.suitable_for.map((tag) => (
              <li
                key={tag}
                className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-200"
              >
                {tag.replace(/_/g, ' ')}
              </li>
            ))}
          </ul>
          <p className="mt-3 font-mono text-[10px] text-zinc-500">
            external_cloud_proxy={String(RUNTIME_PRIVACY_METADATA.external_cloud_proxy)}
          </p>
        </div>
      </div>

      <ul className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {OWASP_REFERENCES.map((ref) => (
          <li key={ref.url}>
            <a
              href={ref.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-zinc-900/60 px-3 py-2 text-xs text-cyan-300 transition hover:border-cyan-500/30 hover:bg-zinc-900"
            >
              {ref.title}
              <ExternalLink className="h-3 w-3 opacity-70" />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function OwaspTagList({
  genai,
  agentic,
  compact = false,
}: {
  genai: string[];
  agentic: string[];
  compact?: boolean;
}) {
  const tags = [...genai, ...agentic];
  if (tags.length === 0) return null;

  return (
    <div className={`flex flex-wrap gap-1.5 ${compact ? '' : 'mt-2'}`}>
      {tags.map((tag) => (
        <span
          key={tag}
          className="rounded-md border border-violet-500/25 bg-violet-500/10 px-2 py-0.5 font-mono text-[10px] text-violet-200"
        >
          {tag.split(':')[0]}
        </span>
      ))}
    </div>
  );
}
