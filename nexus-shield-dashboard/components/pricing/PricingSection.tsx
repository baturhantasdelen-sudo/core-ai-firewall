'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, Sparkles } from 'lucide-react';
import {
  PRICING_TIERS,
  ENTERPRISE_DEMO_URL,
  ENTERPRISE_SALES_EMAIL,
  displayPrice,
  type BillingInterval,
} from '@/config/pricing';
import { DEMO_ORG_ID } from '@/lib/demo-org';
import { BillingToggle } from './BillingToggle';
import { UpgradeButton } from './UpgradeButton';

export function PricingSection() {
  const [interval, setInterval] = useState<BillingInterval>('month');

  return (
    <section className="relative">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-indigo-500/10 blur-3xl"
      />

      <div className="relative mx-auto max-w-6xl px-6 py-16 sm:py-20">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-zinc-900/80 px-3 py-1 text-xs font-medium text-zinc-400">
            <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
            B2B SaaS Pricing
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-zinc-100 sm:text-4xl lg:text-5xl">
            Ship secure AI &amp; CI/CD without enterprise friction
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm text-zinc-400 sm:text-base">
            Start free with 1,000 API requests. Scale to Pro for production guardrails, SCA, and
            real-time GitHub Checks — or talk to us for on-premise &amp; compliance.
          </p>

          <div className="mt-10">
            <BillingToggle interval={interval} onChange={setInterval} />
          </div>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {PRICING_TIERS.map((tier) => {
            const isEnterprise = tier.id === 'enterprise';
            const isPro = tier.id === 'pro';
            const price = displayPrice(tier, interval);

            return (
              <div
                key={tier.id}
                className={`relative flex flex-col rounded-2xl border p-8 backdrop-blur-sm ${
                  tier.highlighted
                    ? 'border-indigo-500/40 bg-zinc-900/80 shadow-2xl shadow-indigo-500/10 ring-1 ring-indigo-500/20'
                    : 'border-white/10 bg-zinc-900/50'
                }`}
              >
                {tier.badge ? (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
                    {tier.badge}
                  </span>
                ) : null}

                <div>
                  <h2
                    className={`text-sm font-semibold uppercase tracking-wide ${
                      isPro ? 'text-indigo-400' : 'text-zinc-400'
                    }`}
                  >
                    {tier.name}
                  </h2>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-4xl font-semibold tracking-tight text-zinc-100">
                      {price}
                    </span>
                    {!isEnterprise && tier.monthlyPrice !== null ? (
                      <span className="text-sm text-zinc-500">/mo</span>
                    ) : null}
                  </div>
                  {isPro && interval === 'year' ? (
                    <p className="mt-1 text-xs text-emerald-400/90">
                      Billed annually at $588/yr
                    </p>
                  ) : null}
                  <p className="mt-3 text-sm text-zinc-500">{tier.description}</p>
                </div>

                <ul className="mt-8 flex-1 space-y-3">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5 text-sm text-zinc-300">
                      <Check
                        className={`mt-0.5 h-4 w-4 shrink-0 ${
                          isPro ? 'text-indigo-400' : 'text-zinc-500'
                        }`}
                      />
                      {feature}
                    </li>
                  ))}
                </ul>

                <div className="mt-8 space-y-3">
                  {tier.id === 'developer' ? (
                    <Link
                      href="/dashboard"
                      className="inline-flex w-full items-center justify-center rounded-lg border border-white/10 bg-zinc-800/80 px-4 py-3 text-sm font-semibold text-zinc-200 transition-colors hover:border-white/20 hover:bg-zinc-800"
                    >
                      {tier.cta}
                    </Link>
                  ) : null}

                  {isPro ? (
                    <UpgradeButton
                      orgId={DEMO_ORG_ID}
                      billingInterval={interval}
                      label={tier.cta}
                    />
                  ) : null}

                  {isEnterprise ? (
                    <>
                      <a
                        href={ENTERPRISE_SALES_EMAIL}
                        className="inline-flex w-full items-center justify-center rounded-lg border border-white/10 bg-zinc-800/80 px-4 py-3 text-sm font-semibold text-zinc-200 transition-colors hover:border-white/20 hover:bg-zinc-800"
                      >
                        Contact Sales
                      </a>
                      <a
                        href={ENTERPRISE_DEMO_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex w-full items-center justify-center rounded-lg bg-gradient-to-r from-indigo-500/90 to-fuchsia-500/90 px-4 py-3 text-sm font-semibold text-white transition-transform hover:scale-[1.02]"
                      >
                        Book a Demo
                      </a>
                    </>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-10 text-center text-xs text-zinc-600">
          All plans include HTTPS, webhook signing, and Supabase-backed org isolation. Prices in
          USD. Taxes may apply.
        </p>
      </div>
    </section>
  );
}
