import { BrandLogo } from '@/components/brand/BrandLogo';
import { ContactEmail } from '@/components/landing/ContactEmail';

export function LandingFooter() {
  return (
    <footer className="border-t border-white/5">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 py-8 text-xs text-zinc-500 sm:flex-row">
        <div className="flex select-none items-center gap-3">
          <BrandLogo size={28} showText={false} />
          <span className="select-none">
            © {new Date().getFullYear()} Nexus Shield. All rights reserved.
          </span>
        </div>
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-6">
          <ContactEmail variant="footer" />
          <div className="flex items-center gap-6">
            <a href="#pricing" className="select-none cursor-pointer transition-colors hover:text-zinc-300">
              Pricing
            </a>
            <a href="#contact" className="select-none cursor-pointer transition-colors hover:text-zinc-300">
              Contact
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
