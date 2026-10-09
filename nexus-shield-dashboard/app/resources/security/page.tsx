import type { Metadata } from 'next';
import { MarketingPageLayout } from '@/components/marketing/MarketingPageLayout';

export const metadata: Metadata = { title: 'Security | Nexus Shield Resources' };

export default function Page() {
  return (
    <MarketingPageLayout eyebrow="Resources" title="Security" description="Control layer: PII, secrets, prompt injection, action firewall — supporting the assurance platform.">
      <p>Trust center: <a href="/trust">/trust</a>. Repo SECURITY.md.</p>
    </MarketingPageLayout>
  );
}
