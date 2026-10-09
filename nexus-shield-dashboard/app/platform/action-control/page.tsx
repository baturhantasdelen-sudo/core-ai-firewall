import type { Metadata } from 'next';
import { MarketingCtaRow, MarketingPageLayout } from '@/components/marketing/MarketingPageLayout';

export const metadata: Metadata = {
  title: 'Action Control | Nexus Shield',
};

export default function Page() {
  return (
    <MarketingPageLayout eyebrow="Platform — CONTROL" title="Action Control" description="Policy-as-code, intent divergence, action firewall, PII/secret/prompt controls, capability revocation, and human approval.">
      <p>Evaluate API: <code>POST /api/v1/action/evaluate</code>. Legacy security engines sit here as supporting controls — not the product category.</p>
      <MarketingCtaRow />
    </MarketingPageLayout>
  );
}
