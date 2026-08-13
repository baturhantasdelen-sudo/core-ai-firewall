import { Building2, Globe, Lock, ShieldCheck, Zap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

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
    title: 'Sub-10ms Latency',
    description:
      'Early-exit regex and semantic guardrails inspect prompts in single-digit milliseconds — no queue, no build-step slowdown.',
  },
  {
    icon: Lock,
    accent: 'bg-fuchsia-500/10 text-fuchsia-400',
    title: 'Zero-Data Leaks',
    description:
      'PII, secrets, and injection payloads are masked or blocked before they reach your LLM. Source code never leaves your pipeline.',
  },
  {
    icon: ShieldCheck,
    accent: 'bg-emerald-500/10 text-emerald-400',
    title: 'KVKK / GDPR Compliance',
    description:
      'TCKN, credit card, email, and API key patterns are redacted automatically with audit-friendly telemetry metadata.',
  },
  {
    icon: Globe,
    accent: 'bg-indigo-500/10 text-indigo-400',
    title: 'Multi-LLM Proxy',
    description:
      'One gateway for OpenAI, Google Gemini, Anthropic Claude, and local Ollama — swap models without rewriting security logic.',
  },
  {
    icon: Building2,
    accent: 'bg-amber-500/10 text-amber-400',
    title: 'Enterprise & Defence Ready',
    description:
      'Air-gapped and on-premise deployment with zero external egress. Native Self-Hosted GitLab, Jenkins, and GitHub Enterprise integration with TR PII compliance.',
  },
];

export function FeaturesGrid() {
  return (
    <section id="features" className="scroll-mt-20 mx-auto max-w-7xl px-6 py-20">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-semibold tracking-tight text-zinc-100 sm:text-4xl">
          Enterprise-Grade AI Guardrails
        </h2>
        <p className="mt-3 text-sm text-zinc-500 sm:text-base">
          Protect LLM apps and CI/CD pipelines with zero-latency detection and DevSecOps-native
          workflows.
        </p>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
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
