import type { Metadata } from 'next';
import { MarketingPageLayout } from '@/components/marketing/MarketingPageLayout';

export const metadata: Metadata = { title: 'Case Studies | Nexus Shield' };

export default function Page() {
  return (
    <MarketingPageLayout eyebrow="Resources" title="Case Studies" description="Customer case studies — add as published. Example scenarios on homepage are labeled DEMO.">
      <p>Contact sales for POC narratives.</p>
    </MarketingPageLayout>
  );
}
