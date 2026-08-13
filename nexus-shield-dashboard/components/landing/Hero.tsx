import Link from 'next/link';
import { ArrowRight, Building2, Sparkles } from 'lucide-react';

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[-10rem] h-[36rem] w-[36rem] -translate-x-1/2 rounded-full bg-indigo-500/20 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute right-[-10rem] top-32 h-[26rem] w-[26rem] rounded-full bg-fuchsia-500/10 blur-3xl"
      />

      <div className="relative mx-auto max-w-4xl px-6 py-20 text-center sm:py-28">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-zinc-900/80 px-3 py-1 text-xs font-medium text-zinc-400">
            <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
            DevSecOps Native — Regional PII &amp; Secret Engine
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300">
            <Building2 className="h-3.5 w-3.5" />
            Enterprise &amp; Defence Ready
          </div>
        </div>

        <h1 className="mt-6 text-4xl font-semibold tracking-tight text-zinc-100 sm:text-5xl lg:text-6xl lg:leading-[1.08]">
          Ultra-fast, policy-driven{' '}
          <span className="bg-gradient-to-r from-indigo-400 via-fuchsia-400 to-indigo-400 bg-clip-text text-transparent">
            PII &amp; secret protection
          </span>{' '}
          for developer workflows
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-base text-zinc-400 sm:text-lg">
          Prevent data leaks, mask PII, and block credential exposure across GitHub, GitLab, and
          CI/CD pipelines with{' '}
          <span className="font-medium text-zinc-200">sub-10ms policy-driven engine</span> and{' '}
          <span className="font-medium text-zinc-200">SARIF 2.1.0 support</span>.
        </p>

        <ul className="mx-auto mt-5 max-w-2xl space-y-2 text-left text-sm text-zinc-500 sm:text-center">
          <li>
            <span className="font-medium text-zinc-300">Air-Gapped &amp; On-Premise Support</span>{' '}
            — zero data egress; sensitive workloads never leave your closed network.
          </li>
          <li>
            <span className="font-medium text-zinc-300">Self-Hosted GitLab &amp; Jenkins Integration</span>{' '}
            — deploy in private CI/CD with GitHub Enterprise Server.
          </li>
          <li>
            <span className="font-medium text-zinc-300">Local Data Protection &amp; TR PII Standards</span>{' '}
            — KVKK-aligned TCKN, VKN, IBAN, and regional policy profiles out of the box.
          </li>
        </ul>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            href="#playground"
            className="group inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-fuchsia-500/20 transition-transform hover:scale-[1.02] hover:shadow-fuchsia-500/30 active:scale-[0.98]"
          >
            Start Free Trial (50 Free Scans)
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </a>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-zinc-900/80 px-6 py-3.5 text-sm font-semibold text-zinc-200 transition-colors hover:border-white/20 hover:bg-zinc-900"
          >
            Go to App / Login
          </Link>
        </div>

        <p className="mt-6 text-xs text-zinc-500">
          No credit card required · 50 free playground scans · Pro from $59/mo ·{' '}
          <a href="#pricing" className="text-indigo-400 hover:text-indigo-300">
            View pricing
          </a>
        </p>
      </div>
    </section>
  );
}
