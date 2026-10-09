import type { ReactNode } from 'react';
import Link from 'next/link';
import { LandingNav } from '@/components/landing/LandingNav';
import { LandingFooter } from '@/components/landing/LandingFooter';
import { NEXUS_VERIFY_WORLD } from '@/lib/brand/copy-standards';

export function MarketingPageLayout({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <LandingNav />
      <main className="mx-auto max-w-4xl px-6 py-14 sm:py-20">
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400/90">{eyebrow}</p>
        ) : null}
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">{title}</h1>
        {description ? <p className="mt-4 text-base leading-relaxed text-zinc-400">{description}</p> : null}
        <p className="mt-4 font-mono text-[11px] text-zinc-600">{NEXUS_VERIFY_WORLD}</p>
        <div className="mt-10 space-y-4 text-sm leading-relaxed text-zinc-400 [&_a]:text-cyan-400 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-zinc-100 [&_li]:ml-4 [&_ul]:list-disc">
          {children}
        </div>
      </main>
      <LandingFooter />
    </div>
  );
}

export function MarketingCtaRow() {
  return (
    <div className="not-prose mt-10 flex flex-wrap gap-3">
      <Link
        href="/assessment"
        className="inline-flex rounded-lg bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-500"
      >
        Get an Agent Assurance Assessment
      </Link>
      <Link
        href="/platform/outcome-verification"
        className="inline-flex rounded-lg border border-white/15 px-5 py-2.5 text-sm font-medium text-zinc-200 transition hover:border-white/25"
      >
        Explore Outcome Verification
      </Link>
    </div>
  );
}
