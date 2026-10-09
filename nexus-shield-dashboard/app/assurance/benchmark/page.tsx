import type { Metadata } from 'next';
import { MarketingCtaRow, MarketingPageLayout } from '@/components/marketing/MarketingPageLayout';

export const metadata: Metadata = {
  title: 'A2B — Independent Agent Action Assurance Benchmark',
  description: 'Reproducible open fixtures for finance, ERP, and CRM outcome assurance.',
};

export default function A2BBenchmarkPage() {
  return (
    <MarketingPageLayout
      eyebrow="Assurance"
      title="Independent Agent Action Assurance Benchmark (A2B)"
      description="Vendor-neutral fixtures. Nexus participates; the benchmark is defined independently of any single vendor score."
    >
      <h2>Reproduce results</h2>
      <pre className="overflow-x-auto rounded-lg bg-zinc-900 p-4 text-xs">{`cd nexus-shield-dashboard
npm run test:benchmark   # 20 scenarios
npm run test:nexus-core  # 24 tests incl. outcome engine`}</pre>
      <h2>Scenario mix (measured suite)</h2>
      <ul>
        <li>Finance — 8 scenarios (A2B-F01 … F08)</li>
        <li>ERP — 7 scenarios (A2B-E01 … E07)</li>
        <li>CRM — 5 scenarios (A2B-C01 … C05)</li>
      </ul>
      <h2>Scoring dimensions (methodology target weights)</h2>
      <ul>
        <li>Authorization Assurance — 20%</li>
        <li>Action Integrity — 20%</li>
        <li>Outcome Integrity — 30%</li>
        <li>Evidence Integrity — 20%</li>
        <li>Side-Effect Control — 10%</li>
      </ul>
      <h2>Key metric — False Success Detection Rate</h2>
      <p>
        <strong>Measured on CI fixtures:</strong> 100% detection on designated A2B false-success scenarios (
        <code>A2B-F03</code> and related outcome tests). This is not fleet telemetry.
      </p>
      <h2>Roadmap</h2>
      <p>Benchmark target progression: 20 → 50 → 100+ scenarios. Current shipped open fixtures: <strong>20</strong>.</p>
      <MarketingCtaRow />
    </MarketingPageLayout>
  );
}
