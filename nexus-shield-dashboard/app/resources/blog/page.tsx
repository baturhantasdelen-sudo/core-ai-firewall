import type { Metadata } from 'next';
import { MarketingPageLayout } from '@/components/marketing/MarketingPageLayout';

export const metadata: Metadata = { title: 'Blog | Nexus Shield' };

export default function Page() {
  return (
    <MarketingPageLayout eyebrow="Resources" title="Blog" description="Product updates on agent action assurance — coming soon.">
      <p>Subscribe via contact until blog CMS is wired.</p>
    </MarketingPageLayout>
  );
}
