import type { Metadata } from 'next';
import { MarketingCtaRow, MarketingPageLayout } from '@/components/marketing/MarketingPageLayout';

export const metadata: Metadata = {
  title: 'UAR 2.0 Receipts | Nexus Shield Assurance',
  description: 'Separate action occurrence from outcome verification proof.',
};

export default function UarReceiptsPage() {
  return (
    <MarketingPageLayout
      eyebrow="Assurance"
      title="UAR 2.0 — Universal Action Receipt"
      description="A receipt proves a signed record exists. It does not automatically prove the business outcome was correct — verification does."
    >
      <h2>What happened vs. was it verified?</h2>
      <ul>
        <li><strong>action</strong> — tool execution occurrence (transaction id, executed flag)</li>
        <li><strong>verification</strong> — multi-source reads, diffs, false-success flag, evidence ids</li>
      </ul>
      <h2>Integrity</h2>
      <p>
        SHA-256 parameter, outcome, and evidence hashes; optional UAR hash chain; Ed25519-SHA256 demo signatures (
        <code>lib/nexus-core/uar/</code>).
      </p>
      <h2>Offline verification</h2>
      <pre className="overflow-x-auto rounded-lg bg-zinc-900 p-4 text-xs">{`cd nexus-shield-dashboard
npm run nexus-proof -- path/to/proof.json`}</pre>
      <p>Exit code 0 only when schema, hash, and signature checks pass for the file you provide.</p>
      <h2>Export</h2>
      <p>
        After evaluate, use <code>GET /api/v1/proof/&#123;transaction_id&#125;/export</code> for manifest + proof JSON
        (requires API key; production data only when backend has stored proof).
      </p>
      <MarketingCtaRow />
    </MarketingPageLayout>
  );
}
