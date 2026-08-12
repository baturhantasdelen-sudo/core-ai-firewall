import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';

export function LandingNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-zinc-950/80 backdrop-blur-md">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-indigo-400" />
          <span className="text-sm font-semibold tracking-tight text-zinc-100">Nexus Shield</span>
        </div>

        <div className="hidden items-center gap-8 text-sm text-zinc-400 sm:flex">
          <a href="#features" className="transition-colors hover:text-zinc-100">
            Features
          </a>
          <a href="#roadmap" className="transition-colors hover:text-zinc-100">
            Roadmap
          </a>
          <Link href="/pricing" className="transition-colors hover:text-zinc-100">
            Pricing
          </Link>
        </div>

        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center rounded-lg border border-white/10 bg-zinc-900/80 px-4 py-2 text-sm font-medium text-zinc-200 transition-colors hover:border-white/20 hover:bg-zinc-900"
        >
          Start Free Beta
        </Link>
      </nav>
    </header>
  );
}
