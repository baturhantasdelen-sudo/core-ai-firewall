import Link from 'next/link';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { ChallengeSandboxPanel } from '@/components/challenge/ChallengeSandboxPanel';

export const metadata = {
  title: 'Nexus Shield Challenge Engine | 7-Level Agent Security Sandbox',
  description:
    'Gamified AI agent security challenge — prompt injection, tool misuse, MCP poisoning, and production DB attacks with verifiable SHA-256 proof badges.',
};

export default function ChallengePage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-white/5 bg-zinc-950/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <BrandLogo size={32} />
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-zinc-400 transition hover:text-zinc-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-12">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/5 px-4 py-1.5 text-xs font-medium text-violet-300">
            <ShieldCheck className="h-3.5 w-3.5" />
            Module 2 — Gamified Challenge Engine
          </div>
          <h1 className="mt-6 text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
            Nexus Shield Challenge Engine
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm text-zinc-500 sm:text-base">
            Seven-level AI Agent Security Sandbox — submit attack payloads, earn verifiable
            cryptographic proof badges, and climb the leaderboard.
          </p>
        </div>

        <div className="mt-10">
          <ChallengeSandboxPanel />
        </div>
      </main>
    </div>
  );
}
