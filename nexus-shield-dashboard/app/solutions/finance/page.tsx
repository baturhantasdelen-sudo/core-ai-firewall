import type { Metadata } from 'next';
import { MarketingCtaRow, MarketingPageLayout } from '@/components/marketing/MarketingPageLayout';

export const metadata: Metadata = {
  title: 'Finance Agent Assurance | Nexus Shield',
  description: 'Verify payments, refunds, and transfers against authoritative ledger and processor state.',
};

export default function FinanceSolutionPage() {
  return (
    <MarketingPageLayout
      eyebrow="Solutions — Finance"
      title="Assurance for financial agent actions"
      description="For CISOs, Finance Operations, and platform teams running payment, refund, and transfer agents."
    >
      <ul>
        <li>Erroneous payouts and amount manipulation (expected vs. actual on payment_provider + ledger)</li>
        <li>False success when processor returns 200 but settlement is PENDING</li>
        <li>Currency and customer / invoice binding checks</li>
        <li>Ledger reconciliation evidence in UAR 2.0 proof exports</li>
      </ul>
      <p>
        Vertical read adapter: <code>lib/nexus-core/adapters/vertical/finance-adapter.ts</code> (read-only verification).
      </p>
      <MarketingCtaRow />
    </MarketingPageLayout>
  );
}
