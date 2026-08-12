import { ShieldCheck } from 'lucide-react';

export function LandingFooter() {
  return (
    <footer className="border-t border-white/5">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 py-8 text-xs text-zinc-500 sm:flex-row">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-zinc-600" />
          <span>© {new Date().getFullYear()} Nexus Shield. All rights reserved.</span>
        </div>
        <div className="flex items-center gap-6">
          <a href="/pricing" className="transition-colors hover:text-zinc-300">
            Pricing
          </a>
          <a href="mailto:demo@nexusshield.dev" className="transition-colors hover:text-zinc-300">
            Contact
          </a>
        </div>
      </div>
    </footer>
  );
}
