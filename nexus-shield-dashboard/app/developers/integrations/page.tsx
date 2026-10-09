import type { Metadata } from 'next';
import { MarketingCtaRow, MarketingPageLayout } from '@/components/marketing/MarketingPageLayout';

export const metadata: Metadata = { title: 'Integrations | Nexus Shield' };

export default function Page() {
  return (
    <MarketingPageLayout eyebrow="Developers" title="Integrations" description="Works alongside ERP, CRM, IAM, MCP, and cloud — independent assurance layer.">
      <p>No implied official partnerships unless documented. Use read-only outcome adapters with scoped credentials.</p>
      <MarketingCtaRow />
    </MarketingPageLayout>
  );
}
