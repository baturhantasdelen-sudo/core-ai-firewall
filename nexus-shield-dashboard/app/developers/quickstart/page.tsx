import type { Metadata } from 'next';
import { MarketingCtaRow, MarketingPageLayout } from '@/components/marketing/MarketingPageLayout';

export const metadata: Metadata = { title: 'Developer Quickstart | Nexus Shield' };

export default function Page() {
  return (
    <MarketingPageLayout eyebrow="Developers" title="Quickstart SDK" description="Agent action control, verification, and proof — not PII-guardrail-only positioning.">
      <pre className="overflow-x-auto rounded-lg bg-zinc-900 p-4 text-xs">{`cd nexus-shield-dashboard
npm run test:nexus-core
# Evaluate: POST /api/v1/action/evaluate
# Outcome:  POST /api/v1/outcome/verify`}</pre>
      <p>Python / npm SDKs in <code>packages/</code>. See repo <code>docs/QUICKSTART_DEVELOPER.md</code>.</p>
      <MarketingCtaRow />
    </MarketingPageLayout>
  );
}
