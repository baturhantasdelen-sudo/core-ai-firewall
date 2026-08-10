import Link from 'next/link';
import { Check, ShieldCheck } from 'lucide-react';
import { UpgradeButton } from '@/components/pricing/UpgradeButton';
import { DEMO_ORG_ID } from '@/lib/demo-org';

const FREE_FEATURES = ['50 Scans / mo', 'Basic PII & Secret Scan', 'Public GitHub Action'];

const PRO_FEATURES = ['Unlimited Scans', 'Centralized Dashboard', 'Custom Regex', 'Priority Support'];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-5xl px-6 py-16">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-zinc-900/80 px-3 py-1 text-xs font-medium text-zinc-400">
            <ShieldCheck className="h-3.5 w-3.5 text-indigo-400" />
            Nexus Shield Pricing
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
            Simple, transparent pricing
          </h1>
          <p className="mt-3 text-sm text-zinc-500 sm:text-base">
            Start free. Upgrade when your team needs unlimited scans and priority support.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Free Tier */}
          <div className="flex flex-col rounded-2xl border border-white/10 bg-zinc-900/60 p-8 backdrop-blur-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">Free Tier</h2>
            <div className="mt-3 flex items-baseline gap-1">
              <span className="text-4xl font-semibold tracking-tight text-zinc-100">$0</span>
              <span className="text-sm text-zinc-500">/mo</span>
            </div>
            <p className="mt-2 text-sm text-zinc-500">For individuals and small side projects.</p>

            <ul className="mt-8 flex-1 space-y-3">
              {FREE_FEATURES.map((feature) => (
                <li key={feature} className="flex items-center gap-2.5 text-sm text-zinc-300">
                  <Check className="h-4 w-4 shrink-0 text-zinc-500" />
                  {feature}
                </li>
              ))}
            </ul>

            <Link
              href="/dashboard"
              className="mt-8 inline-flex w-full items-center justify-center rounded-lg border border-white/10 bg-zinc-800/80 px-4 py-3 text-sm font-semibold text-zinc-200 transition-colors hover:border-white/20 hover:bg-zinc-800"
            >
              Continue with Free
            </Link>
          </div>

          {/* Pro Tier */}
          <div className="relative flex flex-col rounded-2xl border border-indigo-500/30 bg-zinc-900/60 p-8 shadow-2xl shadow-indigo-500/10 backdrop-blur-sm">
            <span className="absolute -top-3 right-8 rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
              Most Popular
            </span>

            <h2 className="text-sm font-semibold uppercase tracking-wide text-indigo-400">Pro Tier</h2>
            <div className="mt-3 flex items-baseline gap-1">
              <span className="text-4xl font-semibold tracking-tight text-zinc-100">$79</span>
              <span className="text-sm text-zinc-500">/mo</span>
            </div>
            <p className="mt-2 text-sm text-zinc-500">For teams that need unlimited coverage.</p>

            <ul className="mt-8 flex-1 space-y-3">
              {PRO_FEATURES.map((feature) => (
                <li key={feature} className="flex items-center gap-2.5 text-sm text-zinc-200">
                  <Check className="h-4 w-4 shrink-0 text-indigo-400" />
                  {feature}
                </li>
              ))}
            </ul>

            <div className="mt-8">
              <UpgradeButton orgId={DEMO_ORG_ID} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
