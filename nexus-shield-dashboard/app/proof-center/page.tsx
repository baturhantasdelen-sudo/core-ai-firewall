import Link from 'next/link';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { LandingNav } from '@/components/landing/LandingNav';
import { LandingFooter } from '@/components/landing/LandingFooter';
import { PublicProofCenterSection } from '@/components/landing/PublicProofCenterSection';
import { ProveItDemoCard } from '@/components/landing/ProveItDemoCard';

export const dynamic = 'force-dynamic';

export default function ProofCenterPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <LandingNav />

      <section className="border-b border-white/5 bg-zinc-950 py-14">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-200">
            <ShieldCheck className="h-3.5 w-3.5" />
            IDENTITY → INTENT → ACTION → PROOF
          </div>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight text-zinc-50 sm:text-5xl">
            Nexus Shield Proof Center
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-zinc-400">
            Verify Every Agent Outcome with Cryptographic Proof — live benchmarks, attack resilience,
            and immutable evidence chains for investor due diligence.
          </p>
          <Link
            href="/dashboard/trust-hub"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 px-6 py-3 text-sm font-semibold text-zinc-950 transition hover:opacity-90"
          >
            Open Live Trust Hub
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <PublicProofCenterSection compact />

      <section className="mx-auto max-w-7xl px-6 pb-20">
        <ProveItDemoCard />
      </section>

      <LandingFooter />
    </div>
  );
}
