import { Building2, FileCheck, Globe2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface ComplianceCard {
  icon: LucideIcon;
  title: string;
  description: string;
  accent: string;
}

const COMPLIANCE_CARDS: ComplianceCard[] = [
  {
    icon: FileCheck,
    title: 'SOC 2 Type II',
    description: 'SOC 2 Type II compliant infrastructure and audit logging.',
    accent: 'bg-indigo-500/10 text-indigo-400',
  },
  {
    icon: Globe2,
    title: 'GDPR & KVKK',
    description:
      'Automatic PII detection and redaction compliant with European and Turkish data protection laws.',
    accent: 'bg-emerald-500/10 text-emerald-400',
  },
  {
    icon: Building2,
    title: 'HIPAA & ISO 27001 Ready',
    description:
      'Enterprise-ready controls for healthcare and strict security environments.',
    accent: 'bg-amber-500/10 text-amber-400',
  },
];

export function ComplianceSection() {
  return (
    <section id="compliance" className="scroll-mt-20 mx-auto max-w-7xl px-6 py-20">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-semibold tracking-tight text-zinc-100 sm:text-4xl">
          Compliance
        </h2>
        <p className="mt-3 text-sm text-zinc-500 sm:text-base">
          Certifications and regulatory alignment for regulated industries.
        </p>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-3">
        {COMPLIANCE_CARDS.map(({ icon: Icon, title, description, accent }) => (
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
