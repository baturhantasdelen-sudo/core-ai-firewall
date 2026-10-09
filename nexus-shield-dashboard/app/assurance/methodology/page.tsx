import type { Metadata } from 'next';
import Link from 'next/link';
import { MarketingCtaRow, MarketingPageLayout } from '@/components/marketing/MarketingPageLayout';

export const metadata: Metadata = { title: 'Assurance Methodology | Nexus Shield' };

export default function Page() {
  return (
    <MarketingPageLayout eyebrow="Assurance" title="Methodology" description="How we classify claims: IMPLEMENTED, TESTED, MEASURED, DEMONSTRATION, TARGET, ROADMAP.">
      <p>See <Link href="/assurance/benchmark">A2B benchmark</Link> and repo <code>docs/benchmark-2027.md</code>.</p>
      <MarketingCtaRow />
    </MarketingPageLayout>
  );
}
