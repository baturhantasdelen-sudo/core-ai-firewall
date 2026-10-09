import type { Metadata } from 'next';
import { MarketingCtaRow, MarketingPageLayout } from '@/components/marketing/MarketingPageLayout';

export const metadata: Metadata = {
  title: 'ERP Agent Assurance | Nexus Shield',
  description: 'Invoice closure, balance reconciliation, and tamper detection for ERP-integrated agents.',
};

export default function ErpSolutionPage() {
  return (
    <MarketingPageLayout
      eyebrow="Solutions — ERP"
      title="Assurance for ERP-integrated agents"
      description="Unverified invoice closures and silent ERP tampering are false-success patterns Nexus detects via authoritative reads."
    >
      <ul>
        <li>Invoice PAID vs PENDING mismatches → UNVERIFIED</li>
        <li>Balance reconciliation diffs → FAILED</li>
        <li>Unauthorized field changes on closed invoices</li>
        <li>Compatible with SAP-style adapters in the evaluate pipeline</li>
      </ul>
      <MarketingCtaRow />
    </MarketingPageLayout>
  );
}
