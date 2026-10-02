import Link from 'next/link';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { LandingNav } from '@/components/landing/LandingNav';
import { LandingFooter } from '@/components/landing/LandingFooter';
import { EnterpriseTrustContent } from '@/components/trust/enterprise-trust-content';

export const metadata = {
  title: 'Trust Center — Nexus Shield',
  description:
    'Enterprise trust: air-gapped deployment, Helm & Compose paths, secret management, and security signals for the Action Control Plane.',
};

export default function TrustPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <LandingNav />
      <main className="mx-auto max-w-4xl px-6 pb-20 pt-28">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-500 transition hover:text-zinc-300"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to home
        </Link>
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <ShieldCheck className="h-7 w-7 text-emerald-400" />
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Trust Center</h1>
        </div>
        <p className="mt-3 max-w-2xl text-sm text-zinc-500 sm:text-base">
          Operational deployment paths, air-gapped architecture, and verifiable security signals for
          enterprise buyers and security architecture teams.
        </p>
        <div className="mt-10">
          <EnterpriseTrustContent />
        </div>
      </main>
      <LandingFooter />
    </div>
  );
}
