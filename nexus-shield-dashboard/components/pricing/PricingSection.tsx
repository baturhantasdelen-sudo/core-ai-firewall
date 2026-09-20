'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Check, Code2, Sparkles } from 'lucide-react';
import {
  PRICING_TIERS,
  ENTERPRISE_DEMO_URL,
  ENTERPRISE_SALES_EMAIL,
  SDK_DOCS_URL,
  annualTotal,
  displayPrice,
  type BillingInterval,
} from '@/config/pricing';
import { BillingToggle } from './BillingToggle';
import { UpgradeButton } from './UpgradeButton';

interface PricingSectionProps {
  standalone?: boolean;
}

export function PricingSection({ standalone = false }: PricingSectionProps) {
  const [interval, setInterval] = useState<BillingInterval>('month');

  return (
    <section
      id={standalone ? undefined : 'pricing'}
      data-demo="pricing-page"
      className={`relative ${standalone ? '' : 'scroll-mt-20'}`}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-indigo-500/10 blur-3xl"
      />

      <div className="relative mx-auto max-w-7xl px-6 py-16 sm:py-20">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-zinc-900/80 px-3 py-1 text-xs font-medium text-zinc-400">
            <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
            Agent-Centric B2B Tiering
          </div>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-zinc-100 sm:text-4xl lg:text-5xl">
            Pricing for AI agent runtime security
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm text-zinc-400 sm:text-base">
            Protect agents by count and intercepted tool calls — from sandbox engineers to enterprise
            FinTech control planes with cryptographic proof vaults.
          </p>

          <div className="mt-10">
            <BillingToggle interval={interval} onChange={setInterval} />
          </div>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {PRICING_TIERS.map((tier) => {
            const isEnterprise = tier.id === 'enterprise';
            const isTeam = tier.id === 'team';
            const isDeveloper = tier.id === 'developer';
            const price = displayPrice(tier, interval);
            const yearlyTotal = annualTotal(tier);

            return (
              <div
                key={tier.id}
                className={`relative flex flex-col rounded-2xl border p-6 backdrop-blur-sm sm:p-8 ${
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
                      tier.highlighted ? 'text-indigo-400' : 'text-zinc-400'
                    }`}
                  >
                    {tier.name}
                  </h2>
                  <p className="mt-1 text-xs font-medium text-zinc-500">{tier.target}</p>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-4xl font-semibold tracking-tight text-zinc-100">
                      {price}
                    </span>
                    {!isEnterprise && tier.monthlyPrice !== null ? (
                      <span className="text-sm text-zinc-500">/mo</span>
                    ) : null}
                  </div>
                  {yearlyTotal && interval === 'year' && !isEnterprise ? (
                    <p className="mt-1 text-xs text-emerald-400/90">
                      Billed annually at ${yearlyTotal.toLocaleString('en-US')}/yr
                    </p>
                  ) : null}
                  <p className="mt-3 rounded-lg border border-white/5 bg-zinc-950/50 px-3 py-2 font-mono text-xs text-cyan-300/90">
                    {tier.metrics}
                  </p>
                  <p className="mt-3 text-sm text-zinc-500">{tier.description}</p>
                </div>

                <ul className="mt-8 flex-1 space-y-3">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5 text-sm text-zinc-300">
                      <Check
                        className={`mt-0.5 h-4 w-4 shrink-0 ${
                          tier.highlighted ? 'text-indigo-400' : 'text-zinc-500'
                        }`}
                      />
                      {feature}
                    </li>
                  ))}
                </ul>

                <div className="mt-8 space-y-3">
                  {isDeveloper ? (
                    <>
                      <Link
                        href="/scan"
                        className="inline-flex w-full items-center justify-center rounded-lg border border-white/10 bg-zinc-800/80 px-4 py-3 text-sm font-semibold text-zinc-200 transition-colors hover:border-white/20 hover:bg-zinc-800"
                      >
                        {tier.cta}
                      </Link>
                      <Link
                        href={SDK_DOCS_URL}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-200 transition-colors hover:bg-emerald-500/15"
                      >
                        <Code2 className="h-4 w-4" />
                        Fix with SDK
                      </Link>
                    </>
                  ) : null}

                  {isTeam ? (
                    <>
                      <UpgradeButton billingInterval={interval} label={tier.cta} plan="team" />
                      <a
                        href={ENTERPRISE_DEMO_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex w-full items-center justify-center rounded-lg border border-white/10 bg-zinc-800/80 px-4 py-3 text-sm font-semibold text-zinc-200 transition-colors hover:border-white/20 hover:bg-zinc-800"
                      >
                        {tier.secondaryCta}
                      </a>
                    </>
                  ) : null}

                  {isEnterprise ? (
                    <>
                      <a
                        href={ENTERPRISE_SALES_EMAIL}
                        className="inline-flex w-full items-center justify-center rounded-lg border border-white/10 bg-zinc-800/80 px-4 py-3 text-sm font-semibold text-zinc-200 transition-colors hover:border-white/20 hover:bg-zinc-800"
                      >
                        {tier.cta}
                      </a>
                      <a
                        href={ENTERPRISE_DEMO_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex w-full items-center justify-center rounded-lg bg-gradient-to-r from-indigo-500/90 to-fuchsia-500/90 px-4 py-3 text-sm font-semibold text-white transition-transform hover:scale-[1.02]"
                      >
                        {tier.secondaryCta}
                      </a>
                    </>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-10 text-center text-xs text-zinc-600">
          All plans include HTTPS, webhook signing, and org isolation. Prices in USD. Taxes may apply.
        </p>
      </div>
    </section>
  );
}
