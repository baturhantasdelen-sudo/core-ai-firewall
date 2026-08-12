import { ShieldCheck } from 'lucide-react';
import { WaitlistForm } from './WaitlistForm';

export function WaitlistBanner() {
  return (
    <section id="waitlist" className="mx-auto max-w-7xl px-6 py-20">
      <div className="relative overflow-hidden rounded-3xl border border-indigo-500/20 bg-gradient-to-br from-indigo-500/10 via-zinc-900 to-fuchsia-500/10 p-8 sm:p-12">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-fuchsia-500/20 blur-3xl"
        />

        <div className="relative mx-auto max-w-xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-zinc-950/60 px-3 py-1 text-xs font-medium text-zinc-400">
            <ShieldCheck className="h-3.5 w-3.5 text-indigo-400" />
            Limited Private Beta Access
          </div>

          <h2 className="mt-5 text-2xl font-semibold tracking-tight text-zinc-100 sm:text-3xl">
            Join the Exclusive Private Beta
          </h2>
          <p className="mt-3 text-sm text-zinc-400 sm:text-base">
            Get early access, priority support, and help shape the roadmap. We onboard a limited number of teams
            every week.
          </p>

          <div className="mt-8">
            <WaitlistForm />
          </div>

          <p className="mt-4 text-xs text-zinc-500">
            Already ready to go?{' '}
            <a href="/dashboard" className="font-medium text-indigo-400 hover:text-indigo-300">
              Install the GitHub App now →
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}
