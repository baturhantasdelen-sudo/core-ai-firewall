import type { Metadata } from 'next';
import { MarketingCtaRow, MarketingPageLayout } from '@/components/marketing/MarketingPageLayout';

export const metadata: Metadata = { title: 'API Reference | Nexus Shield' };

export default function Page() {
  return (
    <MarketingPageLayout eyebrow="Developers" title="API Reference" description="Server-side verification — never trust client-reported status.">
      <ul>
        <li><code>POST /api/v1/action/evaluate</code> — seven-engine pipeline + UAR</li>
        <li><code>POST /api/v1/outcome/verify</code> — standalone outcome verification</li>
        <li><code>GET /api/v1/proof/&#123;transaction_id&#125;</code> — proof viewer</li>
        <li><code>GET /api/v1/proof/&#123;transaction_id&#125;/export</code> — signed export</li>
      </ul>
      <p>Header: <code>x-nexus-api-key</code></p>
      <MarketingCtaRow />
    </MarketingPageLayout>
  );
}
