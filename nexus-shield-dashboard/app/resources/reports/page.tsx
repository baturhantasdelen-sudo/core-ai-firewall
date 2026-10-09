import type { Metadata } from 'next';
import Link from 'next/link';
import { MarketingPageLayout } from '@/components/marketing/MarketingPageLayout';

export const metadata: Metadata = { title: 'Reports | Nexus Shield' };

export default function Page() {
  return (
    <MarketingPageLayout eyebrow="Resources" title="Reports" description="Research and benchmark transparency.">
      <p>
        <Link href="/reports/state-of-agent-security-2026">State of Agent Security 2026</Link>
      </p>
    </MarketingPageLayout>
  );
}
