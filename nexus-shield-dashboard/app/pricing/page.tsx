import Link from 'next/link';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { PricingSection } from '@/components/pricing/PricingSection';

export const metadata = {
  title: 'Pricing | Nexus Shield — Agent-Centric Runtime Security',
  description:
    'Agent-centric B2B pricing — Developer sandbox, Team/Startup ($299/mo), and Enterprise control plane with SHA-256 evidence vaults and native sidecars.',
};

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-white/5 bg-zinc-950/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <BrandLogo size={32} />
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-zinc-400 transition hover:text-zinc-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>
        </div>
      </header>

      <main>
        <div className="mx-auto max-w-6xl px-6 pt-12 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/5 px-4 py-1.5 text-xs font-medium text-indigo-300">
            <Sparkles className="h-3.5 w-3.5" />
            Agent-Centric B2B Tiering
          </div>
        </div>
        <PricingSection standalone />
      </main>
    </div>
  );
}
