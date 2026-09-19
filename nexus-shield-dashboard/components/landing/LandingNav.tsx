'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ChevronDown,
  Menu,
  ScanSearch,
  Trophy,
  X,
} from 'lucide-react';
import { BrandLogo } from '@/components/brand/BrandLogo';

type NavItem = { href: string; label: string; external?: boolean };

const PLATFORM_LINKS: NavItem[] = [
  { href: '/#attack-simulator', label: 'Attack Simulator' },
  { href: '/#playground', label: 'Playground' },
  { href: '/proof-center', label: 'Proof Center' },
  { href: '/#features', label: 'Features' },
];

const TRUST_LINKS: NavItem[] = [
  { href: '/#trust-center', label: 'Trust Center' },
  { href: '/dashboard', label: 'SOC Dashboard' },
  { href: '/#compliance', label: 'Compliance' },
];

const COMPANY_LINKS: NavItem[] = [
  { href: '/pricing', label: 'Pricing' },
  { href: '/investor', label: 'Investor Relations' },
  { href: '/#contact', label: 'Contact' },
  { href: '/docs', label: 'API Docs' },
];

const DROPDOWNS = [
  { id: 'platform', label: 'Platform', links: PLATFORM_LINKS },
  { id: 'trust', label: 'Trust & Compliance', links: TRUST_LINKS },
  { id: 'company', label: 'Company', links: COMPANY_LINKS },
] as const;

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
        <div className="absolute left-0 top-full z-50 mt-2 min-w-[12rem] rounded-xl border border-white/10 bg-zinc-950/95 py-1.5 shadow-xl shadow-black/40 backdrop-blur-md">
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
        {/* Brand */}
        <BrandLogo size={36} />

        {/* Desktop — growth drivers + dropdowns */}
        <div className="hidden items-center gap-4 lg:flex xl:gap-5">
          {/* Growth driver 1: Research 2026 */}
          <Link
            href="/reports/state-of-agent-security-2026"
            className="group relative inline-flex select-none items-center gap-2 whitespace-nowrap text-sm font-semibold text-violet-200 transition hover:text-violet-100"
          >
            Research 2026
            <span className="relative inline-flex items-center rounded-full border border-violet-400/40 bg-violet-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-violet-200 shadow-[0_0_12px_rgba(139,92,246,0.45)]">
              <span className="absolute inset-0 animate-pulse rounded-full bg-violet-400/20" />
              <span className="relative">NEW</span>
            </span>
          </Link>

          {/* Growth driver 2: Free Scan */}
          <Link
            href="/scan"
            className="inline-flex select-none items-center gap-1.5 whitespace-nowrap rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-1.5 text-sm font-semibold text-emerald-300 shadow-[0_0_16px_rgba(16,185,129,0.12)] transition hover:border-emerald-400/50 hover:bg-emerald-500/10 hover:text-emerald-200"
          >
            <ScanSearch className="h-3.5 w-3.5" />
            Free Scan
          </Link>

          {/* Growth driver 3: Challenge */}
          <Link
            href="/challenge"
            className="inline-flex select-none items-center gap-1.5 whitespace-nowrap text-sm font-semibold text-amber-300 transition hover:text-amber-200"
          >
            <Trophy className="h-3.5 w-3.5 text-amber-400" />
            Challenge
          </Link>

          <span className="mx-1 h-5 w-px bg-white/10" aria-hidden />

          {DROPDOWNS.map(({ id, label, links }) => (
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

        {/* Right CTA + mobile toggle */}
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/dashboard"
            className="hidden select-none items-center justify-center rounded-lg border border-white/10 bg-zinc-900/80 px-3 py-2 text-sm font-medium text-zinc-200 transition-colors hover:border-white/20 hover:bg-zinc-900 sm:inline-flex"
          >
            Go to App
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

      {/* Mobile drawer */}
      {mobileOpen ? (
        <div className="border-t border-white/5 bg-zinc-950/95 backdrop-blur-md lg:hidden">
          <div className="mx-auto max-w-7xl space-y-6 px-4 py-5 sm:px-6">
            <div>
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-600">
                Growth Drivers
              </p>
              <div className="space-y-2">
                <Link
                  href="/reports/state-of-agent-security-2026"
                  onClick={closeMobile}
                  className="flex items-center justify-between rounded-xl border border-violet-500/25 bg-violet-500/10 px-4 py-3 text-sm font-semibold text-violet-200"
                >
                  Research 2026
                  <span className="rounded-full border border-violet-400/40 bg-violet-500/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-violet-200 animate-pulse">
                    NEW
                  </span>
                </Link>
                <Link
                  href="/scan"
                  onClick={closeMobile}
                  className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-sm font-semibold text-emerald-300"
                >
                  <ScanSearch className="h-4 w-4" />
                  Free Scan
                </Link>
                <Link
                  href="/challenge"
                  onClick={closeMobile}
                  className="flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm font-semibold text-amber-300"
                >
                  <Trophy className="h-4 w-4 text-amber-400" />
                  Challenge
                </Link>
              </div>
            </div>

            {DROPDOWNS.map(({ id, label, links }) => (
              <div key={id}>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-600">
                  {label}
                </p>
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

            <Link
              href="/dashboard"
              onClick={closeMobile}
              className="flex w-full items-center justify-center rounded-lg border border-white/10 bg-zinc-900 px-4 py-3 text-sm font-medium text-zinc-200"
            >
              Go to App
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}
