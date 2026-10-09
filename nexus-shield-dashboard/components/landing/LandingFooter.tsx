import Link from 'next/link';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { ContactEmail } from '@/components/landing/ContactEmail';
import { NEXUS_PRODUCT_CATEGORY } from '@/lib/brand/copy-standards';
import {
  ASSURANCE_LINKS,
  DEVELOPERS_LINKS,
  PLATFORM_LINKS,
  SOLUTIONS_LINKS,
} from '@/lib/site-navigation';

export function LandingFooter() {
  return (
    <footer className="border-t border-white/5">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-12 sm:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <BrandLogo imageClassName="h-10 w-auto" />
          <p className="mt-3 text-xs text-zinc-500">{NEXUS_PRODUCT_CATEGORY}</p>
          <ContactEmail variant="footer" />
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">Platform</p>
          <ul className="mt-3 space-y-2 text-xs text-zinc-400">
            {PLATFORM_LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="hover:text-zinc-200">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">Solutions</p>
          <ul className="mt-3 space-y-2 text-xs text-zinc-400">
            {SOLUTIONS_LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="hover:text-zinc-200">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">Assurance & Devs</p>
          <ul className="mt-3 space-y-2 text-xs text-zinc-400">
            {[...ASSURANCE_LINKS, ...DEVELOPERS_LINKS.slice(0, 2)].map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="hover:text-zinc-200">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-t border-white/5 py-6 text-center text-xs text-zinc-600">
        © {new Date().getFullYear()} Nexus Shield. All rights reserved.
      </div>
    </footer>
  );
}
