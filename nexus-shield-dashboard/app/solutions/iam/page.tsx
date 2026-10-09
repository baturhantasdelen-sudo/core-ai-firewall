import type { Metadata } from 'next';
import { MarketingCtaRow, MarketingPageLayout } from '@/components/marketing/MarketingPageLayout';

export const metadata: Metadata = { title: 'IAM Agent Assurance | Nexus Shield' };

export default function Page() {
  return (
    <MarketingPageLayout eyebrow="Solutions — IAM" title="IAM assurance" description="Privilege, role, and delegated authority changes require independent verification.">
      <p>Authority engine + AWS IAM outcome adapter in evaluate pipeline. Status: BLOCKED when policy denies.</p>
      <MarketingCtaRow />
    </MarketingPageLayout>
  );
}
