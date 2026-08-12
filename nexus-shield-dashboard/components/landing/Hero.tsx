import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';
import { GithubCheckPreview } from './GithubCheckPreview';

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Ambient gradient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[-10rem] h-[36rem] w-[36rem] -translate-x-1/2 rounded-full bg-indigo-500/20 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute right-[-10rem] top-32 h-[26rem] w-[26rem] rounded-full bg-fuchsia-500/10 blur-3xl"
      />

      <div className="relative mx-auto grid max-w-7xl gap-12 px-6 py-20 sm:py-28 lg:grid-cols-2 lg:items-center lg:gap-8">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-zinc-900/80 px-3 py-1 text-xs font-medium text-zinc-400">
            <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
            Now accepting Private Beta signups
          </div>

          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-zinc-100 sm:text-5xl lg:text-[3.4rem] lg:leading-[1.1]">
            Secure Your CI/CD Pipelines with{' '}
            <span className="bg-gradient-to-r from-indigo-400 via-fuchsia-400 to-indigo-400 bg-clip-text text-transparent">
              Zero-Latency
            </span>{' '}
            Secret Detection
          </h1>

          <p className="mt-6 max-w-xl text-base text-zinc-400 sm:text-lg">
            Stop AWS keys, API tokens, and credentials from leaking to GitHub — with{' '}
            <span className="font-medium text-zinc-200">0ms developer overhead</span> and{' '}
            <span className="font-medium text-zinc-200">AI-powered false positive elimination</span>.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/dashboard"
              className="group inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-fuchsia-500/20 transition-transform hover:scale-[1.02] hover:shadow-fuchsia-500/30 active:scale-[0.98]"
            >
              Start Free Beta
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <a
              href="mailto:demo@nexusshield.dev?subject=Nexus%20Shield%20Demo%20Request"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-zinc-900/80 px-6 py-3.5 text-sm font-semibold text-zinc-200 transition-colors hover:border-white/20 hover:bg-zinc-900"
            >
              Book a Demo
            </a>
          </div>

          <p className="mt-6 text-xs text-zinc-500">
            No credit card required · Free tier includes 1,000 API requests/month · GitHub App
            install in under 2 minutes ·{' '}
            <a href="/pricing" className="text-indigo-400 hover:text-indigo-300">
              View pricing
            </a>
          </p>
        </div>

        <div className="flex justify-center lg:justify-end">
          <GithubCheckPreview />
        </div>
      </div>
    </section>
  );
}
