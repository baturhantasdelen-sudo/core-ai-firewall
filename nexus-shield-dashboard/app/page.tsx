import { Hero } from '@/components/landing/Hero';
import { PlaygroundSection } from '@/components/playground/PlaygroundSection';
import { FeaturesGrid } from '@/components/landing/FeaturesGrid';
import { PricingSection } from '@/components/pricing/PricingSection';
import { DashboardPreview } from '@/components/landing/DashboardPreview';
import { TrustCenterSection } from '@/components/landing/TrustCenterSection';
import { ComplianceSection } from '@/components/landing/ComplianceSection';
import { DocsSection } from '@/components/landing/DocsSection';
import { LandingNav } from '@/components/landing/LandingNav';
import { LandingFooter } from '@/components/landing/LandingFooter';

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <LandingNav />
      <Hero />
      <PlaygroundSection />
      <FeaturesGrid />
      <PricingSection />
      <DashboardPreview />
      <TrustCenterSection />
      <ComplianceSection />
      <DocsSection />
      <LandingFooter />
    </div>
  );
}
