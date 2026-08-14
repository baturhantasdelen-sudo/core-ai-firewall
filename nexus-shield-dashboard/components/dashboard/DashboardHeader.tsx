'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Check, Copy, KeyRound } from 'lucide-react';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { DASHBOARD_NAV_ITEMS } from '@/lib/dashboard-nav';
import { SetupGuideModal } from './SetupGuideModal';

interface DashboardHeaderProps {
  apiKey: string;
}

function maskApiKey(apiKey: string): string {
  const visibleSuffix = apiKey.slice(-4);
  return `${apiKey.slice(0, 9)}${'•'.repeat(12)}${visibleSuffix}`;
}

function TelemetryBadge() {
  return (
    <span className="inline-flex max-w-full shrink-0 items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.25)]">
      <span className="relative flex h-1.5 w-1.5 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
      </span>
      <span className="truncate">Telemetry Active</span>
    </span>
  );
}

export function DashboardHeader({ apiKey }: DashboardHeaderProps) {
  const pathname = usePathname();
  const [copied, setCopied] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can fail in unsupported/insecure contexts; fail silently.
    }
  }

  return (
    <>
      <header className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <BrandLogo size={32} />
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <h1 className="min-w-0 select-none text-xl font-semibold tracking-tight text-zinc-100 sm:text-2xl">
              Nexus Shield Dashboard
            </h1>
            <TelemetryBadge />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2.5">
          <div className="inline-flex max-w-full shrink-0 items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 shadow-[0_0_10px_rgba(52,211,153,0.12)]">
            <KeyRound className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
            <code className="max-w-[min(100%,14rem)] truncate font-mono text-xs text-zinc-300 sm:max-w-none sm:text-sm">
              {maskApiKey(apiKey)}
            </code>
            <button
              onClick={handleCopy}
              className="shrink-0 rounded-md p-1 text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-200"
              aria-label="Copy API key"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>

          {DASHBOARD_NAV_ITEMS.map(({ label, href, icon: Icon, chip }) => {
            const isActive = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
            const isSetupGuide = label === 'Setup Guide';

            if (isSetupGuide) {
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => setSetupOpen(true)}
                  className={`inline-flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${chip}`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </button>
              );
            }

            return (
              <Link
                key={href}
                href={href}
                className={`inline-flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${chip} ${
                  isActive ? 'ring-1 ring-white/20' : ''
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            );
          })}
        </div>
      </header>

      {setupOpen ? <SetupGuideModal apiKey={apiKey} onClose={() => setSetupOpen(false)} /> : null}
    </>
  );
}
