import { LandingNav } from '@/components/landing/LandingNav';
import { LandingFooter } from '@/components/landing/LandingFooter';
import { PricingSection } from '@/components/pricing/PricingSection';

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <LandingNav />
      <PricingSection />
      <LandingFooter />
    </div>
  );
}
