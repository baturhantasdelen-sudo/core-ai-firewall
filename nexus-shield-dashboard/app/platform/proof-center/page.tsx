import type { Metadata } from 'next';
import Link from 'next/link';
import { MarketingCtaRow, MarketingPageLayout } from '@/components/marketing/MarketingPageLayout';

export const metadata: Metadata = {
  title: 'Proof Center | Nexus Shield',
};

export default function Page() {
  return (
    <MarketingPageLayout eyebrow="Platform — PROVE" title="Proof Center" description="Evidence and proof viewer — WHO, WHY, CAN, WHAT, RESULT, PROOF. Not a generic metrics dashboard.">
      <p>
        Product UI: <Link href="/proof-center">Live Proof Center</Link>. API:{' '}
        <code>GET /api/v1/proof/&#123;transaction_id&#125;</code> after evaluate stores UAR 2.0 proof.
      </p>
      <MarketingCtaRow />
    </MarketingPageLayout>
  );
}
