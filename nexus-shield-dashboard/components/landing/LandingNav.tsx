'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, Menu, X } from 'lucide-react';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { MARKETING_DROPDOWNS, NEXUS_PRIMARY_CTA, SECONDARY_LINKS } from '@/lib/site-navigation';

type NavItem = { href: string; label: string };

function NavAnchor({
  href,
  label,
  className,
  onClick,
}: NavItem & { className?: string; onClick?: () => void }) {
  return (
    <Link href={href} className={className} onClick={onClick}>
      {label}
    </Link>
  );
}

function DesktopDropdown({
  label,
  links,
  open,
  onToggle,
  onClose,
}: {
  label: string;
  links: NavItem[];
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open, onClose]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={onToggle}
        className="inline-flex select-none items-center gap-1 whitespace-nowrap text-sm text-zinc-400 transition-colors hover:text-zinc-100"
        aria-expanded={open}
      >
        {label}
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-50 mt-2 min-w-[14rem] rounded-xl border border-white/10 bg-zinc-950/95 py-1.5 shadow-xl shadow-black/40 backdrop-blur-md">
          {links.map((link) => (
            <NavAnchor
              key={link.href + link.label}
              {...link}
              className="block px-4 py-2.5 text-sm text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-100"
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function LandingNav() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  const closeMobile = useCallback(() => setMobileOpen(false), []);
  const toggleDropdown = useCallback((id: string) => {
    setOpenDropdown((prev) => (prev === id ? null : id));
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  return (
    <header className="sticky top-0 z-50 border-b border-white/5 bg-zinc-950/80 backdrop-blur-md">
      <nav className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
        <Link href="/" className="shrink-0">
          <BrandLogo size={40} />
        </Link>

        <div className="hidden items-center gap-3 lg:flex xl:gap-4">
          {MARKETING_DROPDOWNS.map(({ id, label, links }) => (
            <DesktopDropdown
              key={id}
              label={label}
              links={links}
              open={openDropdown === id}
              onToggle={() => toggleDropdown(id)}
              onClose={() => setOpenDropdown(null)}
            />
          ))}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            href={NEXUS_PRIMARY_CTA.href}
            className="hidden select-none items-center justify-center rounded-lg bg-cyan-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-cyan-500 sm:inline-flex sm:text-sm"
          >
            {NEXUS_PRIMARY_CTA.label}
          </Link>
          <Link
            href="/dashboard"
            className="hidden select-none items-center justify-center rounded-lg border border-white/10 bg-zinc-900/80 px-3 py-2 text-sm font-medium text-zinc-200 transition-colors hover:border-white/20 lg:inline-flex"
          >
            App
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            className="inline-flex select-none items-center justify-center rounded-lg border border-white/10 bg-zinc-900/80 p-2 text-zinc-300 transition hover:border-white/20 hover:text-zinc-100 lg:hidden"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      {mobileOpen ? (
        <div className="border-t border-white/5 bg-zinc-950/95 backdrop-blur-md lg:hidden">
          <div className="mx-auto max-w-7xl space-y-6 px-4 py-5 sm:px-6">
            <Link href={NEXUS_PRIMARY_CTA.href} onClick={closeMobile} className="block rounded-lg bg-cyan-600 px-4 py-3 text-center text-sm font-semibold text-white">
              {NEXUS_PRIMARY_CTA.label}
            </Link>
            {MARKETING_DROPDOWNS.map(({ id, label, links }) => (
              <div key={id}>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-600">{label}</p>
                <div className="space-y-0.5 rounded-xl border border-white/5 bg-zinc-900/40 p-1">
                  {links.map((link) => (
                    <NavAnchor
                      key={link.href + link.label}
                      {...link}
                      onClick={closeMobile}
                      className="block rounded-lg px-3 py-2.5 text-sm text-zinc-400 transition hover:bg-white/5 hover:text-zinc-100"
                    />
                  ))}
                </div>
              </div>
            ))}
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-600">Also</p>
              <div className="space-y-0.5 rounded-xl border border-white/5 bg-zinc-900/40 p-1">
                {SECONDARY_LINKS.map((link) => (
                  <NavAnchor
                    key={link.href}
                    {...link}
                    onClick={closeMobile}
                    className="block rounded-lg px-3 py-2.5 text-sm text-zinc-400"
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
