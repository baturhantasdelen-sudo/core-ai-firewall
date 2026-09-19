import Link from 'next/link';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { PricingSection } from '@/components/pricing/PricingSection';

export const metadata = {
  title: 'Pricing | Nexus Shield — Usage & Action Based Plans',
  description:
    'Developer, Pro, Team, and Enterprise pricing for AI agent security — tool call limits, SHA-256 evidence chains, HITL approval, and on-prem deployment.',
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
            Module 4 — Usage & Action Based Pricing
          </div>
        </div>
        <PricingSection standalone />
      </main>
    </div>
  );
}
