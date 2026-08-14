'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BookOpen, Bot, Check, Copy, Crosshair, FileText, Radar, Settings, ShieldAlert, ShieldCheck } from 'lucide-react';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { SetupGuideModal } from './SetupGuideModal';

interface DashboardHeaderProps {
  apiKey: string;
}

function maskApiKey(apiKey: string): string {
  const visibleSuffix = apiKey.slice(-4);
  return `${apiKey.slice(0, 9)}${'•'.repeat(12)}${visibleSuffix}`;
}

export function DashboardHeader({ apiKey }: DashboardHeaderProps) {
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
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <BrandLogo size={32} />
          <div className="flex items-center gap-3">
            <h1 className="select-none text-xl font-semibold tracking-tight text-zinc-100 sm:text-2xl">
              Dashboard
            </h1>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            Telemetry Active
          </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-zinc-900/80 px-3 py-2">
            <code className="font-mono text-xs text-zinc-400 sm:text-sm">{maskApiKey(apiKey)}</code>
            <button
              onClick={handleCopy}
              className="ml-1 rounded-md p-1 text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-200"
              aria-label="Copy API key"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>

          <button
            onClick={() => setSetupOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-zinc-900/80 px-3 py-2 text-sm font-medium text-zinc-300 transition-colors hover:border-white/20 hover:text-zinc-100"
          >
            <BookOpen className="h-4 w-4" />
            Setup Guide
          </button>

          <Link
            href="/dashboard/agents"
            className="inline-flex items-center gap-2 rounded-lg border border-violet-500/20 bg-violet-500/10 px-3 py-2 text-sm font-medium text-violet-200 transition-colors hover:border-violet-500/30 hover:bg-violet-500/20"
          >
            <Bot className="h-4 w-4" />
            Agents
          </Link>

          <Link
            href="/dashboard/actions"
            className="inline-flex items-center gap-2 rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm font-medium text-rose-200 transition-colors hover:border-rose-500/30 hover:bg-rose-500/20"
          >
            <ShieldAlert className="h-4 w-4" />
            Action Firewall
          </Link>

          <Link
            href="/dashboard/threat-intel"
            className="inline-flex items-center gap-2 rounded-lg border border-indigo-500/20 bg-indigo-500/10 px-3 py-2 text-sm font-medium text-indigo-200 transition-colors hover:border-indigo-500/30 hover:bg-indigo-500/20"
          >
            <Radar className="h-4 w-4" />
            Threat Intel
          </Link>

          <Link
            href="/dashboard/simulator"
            className="inline-flex items-center gap-2 rounded-lg border border-orange-500/20 bg-orange-500/10 px-3 py-2 text-sm font-medium text-orange-200 transition-colors hover:border-orange-500/30 hover:bg-orange-500/20"
          >
            <Crosshair className="h-4 w-4" />
            Red Teaming
          </Link>

          <Link
            href="/dashboard/trust-hub"
            className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-sm font-medium text-cyan-200 transition-colors hover:border-cyan-500/30 hover:bg-cyan-500/20"
          >
            <ShieldCheck className="h-4 w-4" />
            Trust Hub
          </Link>

          <Link
            href="/dashboard/compliance"
            className="inline-flex items-center gap-2 rounded-lg border border-indigo-500/20 bg-indigo-500/10 px-3 py-2 text-sm font-medium text-indigo-200 transition-colors hover:border-indigo-500/30 hover:bg-indigo-500/20"
          >
            <FileText className="h-4 w-4" />
            Compliance
          </Link>

          <Link
            href="/dashboard/settings"
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-zinc-900/80 px-3 py-2 text-sm font-medium text-zinc-300 transition-colors hover:border-white/20 hover:text-zinc-100"
          >
            <Settings className="h-4 w-4" />
            Settings
          </Link>
        </div>
      </header>

      {setupOpen ? <SetupGuideModal apiKey={apiKey} onClose={() => setSetupOpen(false)} /> : null}
    </>
  );
}
