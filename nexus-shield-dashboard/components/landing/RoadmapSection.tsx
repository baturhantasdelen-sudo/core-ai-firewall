import { CheckCircle2, Clock, KeySquare, Package, ShieldHalf } from 'lucide-react';
import { LucideIcon } from 'lucide-react';

interface RoadmapStage {
  icon: LucideIcon;
  title: string;
  description: string;
  status: 'active' | 'soon';
}

const STAGES: RoadmapStage[] = [
  {
    icon: KeySquare,
    title: 'Secret Leakage Detection',
    description: 'Regex + Shannon entropy scanning for API keys, tokens, and credentials on every push and PR.',
    status: 'active',
  },
    {
      icon: Package,
      title: 'SCA / Dependency Scanning',
      description: 'Flag known-vulnerable npm dependencies (CVE/GHSA) via OSV.dev on every manifest change.',
      status: 'active',
    },
  {
    icon: ShieldHalf,
    title: 'SAST · OWASP Top 10',
    description: 'Static analysis for injection, broken access control, and other OWASP Top 10 code-level risks.',
    status: 'soon',
  },
];

export function RoadmapSection() {
  return (
    <section id="roadmap" className="mx-auto max-w-7xl px-6 py-20">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-semibold tracking-tight text-zinc-100 sm:text-4xl">
          One platform, the full pipeline
        </h2>
        <p className="mt-3 text-sm text-zinc-500 sm:text-base">
          Secret detection today. A complete application security gate on the roadmap.
        </p>
      </div>

      <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-3">
        {STAGES.map(({ icon: Icon, title, description, status }, index) => (
          <div key={title} className="relative">
            {index < STAGES.length - 1 ? (
              <div className="absolute right-[-1.5rem] top-8 hidden h-px w-12 bg-gradient-to-r from-white/20 to-transparent md:block" />
            ) : null}

            <div
              className={`h-full rounded-2xl border p-6 backdrop-blur-sm ${
                status === 'active'
                  ? 'border-indigo-500/30 bg-indigo-500/[0.06]'
                  : 'border-white/10 bg-zinc-900/60'
              }`}
            >
              <div className="flex items-center justify-between">
                <div
                  className={`inline-flex h-10 w-10 items-center justify-center rounded-lg ${
                    status === 'active' ? 'bg-indigo-500/15 text-indigo-400' : 'bg-zinc-800 text-zinc-500'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </div>

                {status === 'active' ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-400">
                    <CheckCircle2 className="h-3 w-3" />
                    Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-zinc-800/80 px-2.5 py-1 text-[11px] font-medium text-zinc-400">
                    <Clock className="h-3 w-3" />
                    Coming Soon
                  </span>
                )}
              </div>

              <h3 className="mt-5 text-sm font-semibold text-zinc-100">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-500">{description}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
