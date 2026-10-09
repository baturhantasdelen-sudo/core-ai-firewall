import type { Metadata } from 'next';
import { MarketingCtaRow, MarketingPageLayout } from '@/components/marketing/MarketingPageLayout';

export const metadata: Metadata = {
  title: 'Agent Discovery | Nexus Shield',
};

export default function Page() {
  return (
    <MarketingPageLayout eyebrow="Platform — SEE" title="Agent Discovery" description="Inventory agents, MCP tools, delegation chains, and effective authority before consequential actions run.">
      <p>Implemented via discovery engine and dashboard agents view. Free scan funnel: <a href="/scan">/scan</a>.</p>
      <MarketingCtaRow />
    </MarketingPageLayout>
  );
}
