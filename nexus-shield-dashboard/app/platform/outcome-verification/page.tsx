import type { Metadata } from 'next';
import Link from 'next/link';
import { MarketingCtaRow, MarketingPageLayout } from '@/components/marketing/MarketingPageLayout';

export const metadata: Metadata = {
  title: 'Outcome Verification | Nexus Shield Platform',
  description: 'Authoritative source mappings, comparison operators, and side-effect diff engine.',
};

export default function OutcomeVerificationPage() {
  return (
    <MarketingPageLayout
      eyebrow="Platform"
      title="Outcome Verification"
      description="Expected action → actual action → expected outcome → actual outcome → evidence → verification → proof."
    >
      <h2>Authoritative sources</h2>
      <p>
        Each critical field maps to a system of record — never the agent or tool response alone. Implemented in{' '}
        <code>lib/nexus-core/assurance/authoritative-sources.ts</code>:
      </p>
      <ul>
        <li><code>payment_status</code> → payment_provider</li>
        <li><code>invoice.balance</code> → erp</li>
        <li><code>ledger_entry</code> → ledger</li>
        <li><code>customer_record</code> → crm</li>
        <li><code>user_permission</code> → iam</li>
      </ul>
      <h2>Comparison operators</h2>
      <p>
        EQUALS, NOT_EQUALS, GREATER, LESS, GREATER_OR_EQUAL, LESS_OR_EQUAL, IN, NOT_IN, CONTAINS, MATCHES, EXISTS,
        NOT_EXISTS — with ALL / ANY grouping (<code>lib/nexus-core/assurance/engine.ts</code>).
      </p>
      <h2>Side-effect & diff engine</h2>
      <p>
        Detects unauthorized field mutations, forbidden fields, and bulk updates (
        <code>lib/nexus-core/assurance/side-effects.ts</code>).
      </p>
      <h2>False success detection</h2>
      <p>
        When HTTP 200 / success body conflicts with PENDING ERP or missing ledger rows, status is{' '}
        <strong>UNVERIFIED</strong> — see <code>runAssuranceVerification</code> and outcome verifier.
      </p>
      <h2>API</h2>
      <pre className="overflow-x-auto rounded-lg bg-zinc-900 p-4 text-xs">POST /api/v1/outcome/verify</pre>
      <p>
        Full pipeline: <Link href="/developers/api">POST /api/v1/action/evaluate</Link>
      </p>
      <MarketingCtaRow />
    </MarketingPageLayout>
  );
}
