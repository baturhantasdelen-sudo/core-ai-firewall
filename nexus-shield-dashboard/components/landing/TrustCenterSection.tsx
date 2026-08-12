import { Lock, ShieldCheck, Timer } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface TrustCard {
  icon: LucideIcon;
  title: string;
  description: string;
  accent: string;
}

const TRUST_CARDS: TrustCard[] = [
  {
    icon: Lock,
    title: 'Data Privacy & Encryption',
    description:
      'TLS 1.3 in-transit and AES-256 at-rest encryption for all telemetry logs.',
    accent: 'bg-indigo-500/10 text-indigo-400',
  },
  {
    icon: ShieldCheck,
    title: 'Zero Data Retention (ZDR)',
    description:
      'Prompts and responses are sanitized in-flight and never stored on disk.',
    accent: 'bg-emerald-500/10 text-emerald-400',
  },
  {
    icon: Timer,
    title: 'Incident Response & SLA',
    description:
      '99.99% Uptime SLA with 24/7 automated threat detection and status monitoring.',
    accent: 'bg-fuchsia-500/10 text-fuchsia-400',
  },
];

export function TrustCenterSection() {
  return (
    <section id="trust-center" className="scroll-mt-20 mx-auto max-w-7xl px-6 py-20">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-semibold tracking-tight text-zinc-100 sm:text-4xl">
          Trust Center
        </h2>
        <p className="mt-3 text-sm text-zinc-500 sm:text-base">
          Security, privacy, and reliability commitments for production AI workloads.
        </p>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-3">
        {TRUST_CARDS.map(({ icon: Icon, title, description, accent }) => (
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
