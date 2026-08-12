import { Hero } from '@/components/landing/Hero';
import { FeaturesGrid } from '@/components/landing/FeaturesGrid';
import { RoadmapSection } from '@/components/landing/RoadmapSection';
import { WaitlistBanner } from '@/components/landing/WaitlistBanner';
import { LandingNav } from '@/components/landing/LandingNav';
import { LandingFooter } from '@/components/landing/LandingFooter';

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <LandingNav />
      <Hero />
      <FeaturesGrid />
      <RoadmapSection />
      <WaitlistBanner />
      <LandingFooter />
    </div>
  );
}
