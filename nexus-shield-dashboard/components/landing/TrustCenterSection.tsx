import Link from 'next/link';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { EnterpriseTrustContent } from '@/components/trust/enterprise-trust-content';

export function TrustCenterSection() {
  return (
    <section id="trust-center" className="scroll-mt-20 border-t border-white/5 bg-zinc-950/50 py-20">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-3 py-1 text-xs font-medium text-emerald-300">
            <ShieldCheck className="h-3.5 w-3.5" />
            Enterprise trust
          </div>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-zinc-100 sm:text-4xl">
            Trust Center
          </h2>
          <p className="mt-3 text-sm text-zinc-500 sm:text-base">
            Deployment simplicity, air-gapped guarantees, and CISO-ready signals — without shipping your
            prompts to third parties.
          </p>
          <Link
            href="/trust"
            className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-indigo-400 hover:text-indigo-300"
          >
            Full Trust Page
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="mt-12">
          <EnterpriseTrustContent compact />
        </div>
      </div>
    </section>
  );
}
