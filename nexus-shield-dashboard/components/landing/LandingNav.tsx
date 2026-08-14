import Link from 'next/link';
import { BrandLogo } from '@/components/brand/BrandLogo';

const NAV_LINKS = [
  { href: '#playground', label: 'Playground' },
  { href: '#features', label: 'Features' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#dashboard', label: 'SOC Dashboard' },
  { href: '#trust-center', label: 'Trust Center' },
  { href: '#compliance', label: 'Compliance' },
  { href: '/docs', label: 'API Docs' },
] as const;

const navLinkClass =
  'select-none cursor-pointer whitespace-nowrap transition-colors hover:text-zinc-100';

export function LandingNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-zinc-950/80 backdrop-blur-md">
      <nav className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
        <BrandLogo size={36} />

        <div className="hidden items-center gap-6 text-sm text-zinc-400 xl:flex">
          {NAV_LINKS.map(({ href, label }) => (
            <a key={href} href={href} className={navLinkClass}>
              {label}
            </a>
          ))}
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <Link
            href="/dashboard"
            className="hidden select-none cursor-pointer items-center justify-center rounded-lg border border-white/10 bg-zinc-900/80 px-3 py-2 text-sm font-medium text-zinc-200 transition-colors hover:border-white/20 hover:bg-zinc-900 sm:inline-flex"
          >
            Go to App
          </Link>
          <a
            href="#playground"
            className="inline-flex select-none cursor-pointer items-center justify-center rounded-lg bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-3 py-2 text-sm font-semibold text-white shadow-md shadow-indigo-500/20 transition-transform hover:scale-[1.02] sm:px-4"
          >
            <span className="hidden sm:inline">Start Free Trial (50 Free Scans)</span>
            <span className="sm:hidden">Free Trial</span>
          </a>
        </div>
      </nav>
    </header>
  );
}
