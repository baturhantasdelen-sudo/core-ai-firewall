import { LucideIcon, Lock, ShieldCheck, Sparkles, Zap } from 'lucide-react';

interface Feature {
  icon: LucideIcon;
  accent: string;
  title: string;
  description: string;
}

const FEATURES: Feature[] = [
  {
    icon: Zap,
    accent: 'bg-amber-500/10 text-amber-400',
    title: '0ms Latency Overhead',
    description:
      'Light-weight regex & checksum validation runs on commit/PR — no build step slowdown, no blocked deploys waiting on a scan queue.',
  },
  {
    icon: Sparkles,
    accent: 'bg-indigo-500/10 text-indigo-400',
    title: 'AI False Positive Elimination',
    description:
      'Intelligent context analysis (Shannon entropy + pattern validation) prevents false alarms from example keys, test fixtures, and placeholders.',
  },
  {
    icon: ShieldCheck,
    accent: 'bg-emerald-500/10 text-emerald-400',
    title: 'GitHub Checks Native',
    description:
      'Inline PR annotations land on the exact code line — reviewers see the leak, the type, and the fix without leaving GitHub.',
  },
  {
    icon: Lock,
    accent: 'bg-fuchsia-500/10 text-fuchsia-400',
    title: 'Complete Privacy',
    description:
      'Your source code stays in your pipeline. Only masked secret metadata (type, file, line) is ever sent to Nexus Shield.',
  },
];

export function FeaturesGrid() {
  return (
    <section id="features" className="mx-auto max-w-7xl px-6 py-20">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-semibold tracking-tight text-zinc-100 sm:text-4xl">Why Nexus Shield?</h2>
        <p className="mt-3 text-sm text-zinc-500 sm:text-base">
          Built for teams who ship fast and can&apos;t afford a leaked credential.
        </p>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map(({ icon: Icon, accent, title, description }) => (
          <div
            key={title}
            className="rounded-xl border border-white/10 bg-zinc-900/60 p-6 backdrop-blur-sm transition-colors hover:border-white/20"
          >
            <div className={`inline-flex h-10 w-10 items-center justify-center rounded-lg ${accent}`}>
              <Icon className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-sm font-semibold text-zinc-100">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-500">{description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
