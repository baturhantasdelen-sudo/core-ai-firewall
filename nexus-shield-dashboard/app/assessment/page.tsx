import type { Metadata } from 'next';
import { MarketingPageLayout } from '@/components/marketing/MarketingPageLayout';
import { AssessmentFunnel } from '@/components/assessment/AssessmentFunnel';
import { NEXUS_PRODUCT_CATEGORY } from '@/lib/brand/copy-standards';

export const metadata: Metadata = {
  title: 'Free Agent Assurance Assessment | Nexus Shield',
  description: 'Estimate agent assurance exposure — demo funnel, not a live environment scan.',
};

export default function AssessmentPage() {
  return (
    <MarketingPageLayout
      eyebrow={NEXUS_PRODUCT_CATEGORY}
      title="Free Agent Assurance Assessment"
      description="Generate an ESTIMATE report from your workflow characteristics. For authoritative findings, request a technical assessment or POC."
    >
      <AssessmentFunnel />
    </MarketingPageLayout>
  );
}
