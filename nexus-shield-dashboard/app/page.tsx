import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  Bot,
  Copy,
  Crosshair,
  FileText,
  Radar,
  ScanSearch,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  Zap,
} from 'lucide-react';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { PlaygroundSection } from '@/components/playground/PlaygroundSection';
import { PricingSection } from '@/components/pricing/PricingSection';
import { LandingNav } from '@/components/landing/LandingNav';
import { LandingFooter } from '@/components/landing/LandingFooter';

const PLATFORM_MODULES = [
  {
    number: '1',
    title: 'Setup Guide & Scanner Hub',
    href: '/dashboard',
    icon: BookOpen,
    border: 'border-zinc-500/25',
    accent: 'text-zinc-300',
    chip: 'border-white/10 bg-zinc-900/80 text-zinc-300',
    bullets: [
      'Quick integration & GitHub App onboarding',
      'Active secret validation & VS Code extension',
      'PII/KVKK PDF export from scan hub',
    ],
  },
  {
    number: '2',
    title: 'Agent Asset Discovery',
    href: '/dashboard/agents',
    icon: Bot,
    border: 'border-violet-500/25',
    accent: 'text-violet-400',
    chip: 'border-violet-500/20 bg-violet-500/10 text-violet-200',
    bullets: [
      'Auto-discover LangChain, LlamaIndex & CrewAI',
      'OpenAI Assistants & MCP server mapping',
      'Capability risk scoring per agent',
    ],
  },
  {
    number: '3',
    title: 'Action Firewall',
    href: '/dashboard/actions',
    icon: ShieldAlert,
    border: 'border-rose-500/25',
    accent: 'text-rose-400',
    chip: 'border-rose-500/20 bg-rose-500/10 text-rose-200',
    bullets: [
      'Intent vs. Action consistency engine',
      'Sub-10ms tool call interception',
      'Instant session Kill Switch freeze',
    ],
  },
  {
    number: '4',
    title: 'Threat Intelligence',
    href: '/dashboard/threat-intel',
    icon: Radar,
    border: 'border-indigo-500/25',
    accent: 'text-indigo-400',
    chip: 'border-indigo-500/20 bg-indigo-500/10 text-indigo-200',
    bullets: [
      'Zero-Knowledge threat signatures (#TS-xxxx)',
      'Global immune memory sync',
      '+40 risk on collective pattern match',
    ],
  },
  {
    number: '5',
    title: 'Red Teaming Simulator',
    href: '/dashboard/simulator',
    icon: Crosshair,
    border: 'border-orange-500/25',
    accent: 'text-orange-400',
    chip: 'border-orange-500/20 bg-orange-500/10 text-orange-200',
    bullets: [
      '5 synthetic attack vectors per agent',
      'Automated resilience score (0–100)',
      'Live console attack replay',
    ],
  },
  {
    number: '6',
    title: 'Trust Hub & Reputation',
    href: '/dashboard/trust-hub',
    icon: ShieldCheck,
    border: 'border-cyan-500/25',
    accent: 'text-cyan-400',
    chip: 'border-cyan-500/20 bg-cyan-500/10 text-cyan-200',
    bullets: [
      'Tool-Chain trajectory enforcement',
      'Evidence Chain verification',
      'Memory Poisoning guard & reputation',
    ],
  },
  {
    number: '7',
    title: 'Enterprise Compliance',
    href: '/dashboard/compliance',
    icon: FileText,
    border: 'border-indigo-500/25',
    accent: 'text-indigo-300',
    chip: 'border-indigo-500/20 bg-indigo-500/10 text-indigo-200',
    bullets: [
      'Automated KVKK/GDPR PDF audit reports',
      'Policy management & masking stats',
      'Executive-grade compliance grades',
    ],
  },
] as const;

const QUICK_NAV = [
  { label: 'Agents', href: '/dashboard/agents', chip: 'border-violet-500/20 bg-violet-500/10 text-violet-200 hover:border-violet-500/40' },
  { label: 'Action Firewall', href: '/dashboard/actions', chip: 'border-rose-500/20 bg-rose-500/10 text-rose-200 hover:border-rose-500/40' },
  { label: 'Threat Intel', href: '/dashboard/threat-intel', chip: 'border-indigo-500/20 bg-indigo-500/10 text-indigo-200 hover:border-indigo-500/40' },
  { label: 'Red Teaming', href: '/dashboard/simulator', chip: 'border-orange-500/20 bg-orange-500/10 text-orange-200 hover:border-orange-500/40' },
  { label: 'Trust Hub', href: '/dashboard/trust-hub', chip: 'border-cyan-500/20 bg-cyan-500/10 text-cyan-200 hover:border-cyan-500/40' },
  { label: 'Compliance', href: '/dashboard/compliance', chip: 'border-indigo-500/20 bg-indigo-500/10 text-indigo-200 hover:border-indigo-500/40' },
] as const;

function DashboardHeaderPreview() {
  const navModules = [
    { label: 'Setup Guide', icon: BookOpen, chip: 'border-white/10 bg-zinc-900/80 text-zinc-300' },
    { label: 'Agents', icon: Bot, chip: 'border-violet-500/20 bg-violet-500/10 text-violet-200' },
    { label: 'Action Firewall', icon: ShieldAlert, chip: 'border-rose-500/20 bg-rose-500/10 text-rose-200' },
    { label: 'Threat Intel', icon: Radar, chip: 'border-indigo-500/20 bg-indigo-500/10 text-indigo-200' },
    { label: 'Red Teaming', icon: Crosshair, chip: 'border-orange-500/20 bg-orange-500/10 text-orange-200' },
    { label: 'Trust Hub', icon: ShieldCheck, chip: 'border-cyan-500/20 bg-cyan-500/10 text-cyan-200' },
    { label: 'Compliance', icon: FileText, chip: 'border-indigo-500/20 bg-indigo-500/10 text-indigo-200' },
  ] as const;

  return (
    <div className="mx-auto mt-10 max-w-6xl overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/60 p-4 shadow-2xl shadow-emerald-500/5 backdrop-blur-xl sm:p-5">
      <p className="mb-3 text-center text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
        Live Interactive Header Navigation
      </p>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <BrandLogo size={32} />
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <span className="select-none text-lg font-semibold tracking-tight text-zinc-100 sm:text-xl">
              Dashboard
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.25)]">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </span>
              Telemetry Active
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-zinc-950/80 px-3 py-2">
          <code className="font-mono text-[10px] text-zinc-400 sm:text-xs">nex_••••••••••••4421</code>
          <Copy className="h-3.5 w-3.5 text-zinc-500" aria-hidden />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {navModules.map(({ label, icon: Icon, chip }) => (
          <span
            key={label}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium sm:text-xs ${chip}`}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <LandingNav />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-[-12rem] h-[40rem] w-[40rem] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute right-[-8rem] top-24 h-[28rem] w-[28rem] rounded-full bg-violet-500/10 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-0 left-[-6rem] h-[20rem] w-[20rem] rounded-full bg-rose-500/8 blur-3xl"
        />

        <div className="relative mx-auto max-w-6xl px-6 py-16 sm:py-24">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-4 py-1.5 text-xs font-medium text-emerald-300 backdrop-blur-sm">
              <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
              Complete Runtime Security Platform
            </div>

            <h1 className="mt-8 text-4xl font-semibold tracking-tight text-zinc-50 sm:text-5xl lg:text-6xl lg:leading-[1.08]">
              Nexus Shield —{' '}
              <span className="bg-gradient-to-r from-emerald-400 via-cyan-400 to-violet-400 bg-clip-text text-transparent">
                AI Agent Trust &amp; Runtime Security Platform
              </span>
            </h1>

            <p className="mt-5 text-lg font-medium text-emerald-200/90 sm:text-xl">
              Give every AI agent an identity, a reputation, and a limit.
            </p>

            <p className="mx-auto mt-4 max-w-2xl text-base text-zinc-400 sm:text-lg">
              Discover every agent. Control every action. Prove every critical execution.
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/dashboard"
                className="group inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-7 py-3.5 text-sm font-semibold text-zinc-950 shadow-lg shadow-emerald-500/25 transition-transform hover:scale-[1.02] hover:shadow-emerald-500/40 active:scale-[0.98]"
              >
                Launch Live Dashboard
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/dashboard/trust-hub"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-500/25 bg-cyan-500/5 px-7 py-3.5 text-sm font-semibold text-cyan-100 backdrop-blur-md transition-colors hover:border-cyan-500/40 hover:bg-cyan-500/10"
              >
                <ShieldCheck className="h-4 w-4" />
                Explore Trust Hub
              </Link>
            </div>
          </div>

          <DashboardHeaderPreview />

          <div className="mx-auto mt-8 grid max-w-4xl grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: '7 Modules', sub: 'Full platform stack' },
              { label: 'Telemetry', sub: 'Live SOC signals' },
              { label: 'Sub-10ms', sub: 'Runtime intercept' },
              { label: '#TS-xxxx', sub: 'Immune network' },
            ].map(({ label, sub }) => (
              <div
                key={label}
                className="rounded-xl border border-white/8 bg-white/3 px-4 py-3 text-center backdrop-blur-md"
              >
                <p className="text-sm font-semibold text-emerald-300 sm:text-base">{label}</p>
                <p className="text-[10px] text-zinc-500 sm:text-xs">{sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Quick Nav Strip */}
      <section className="border-y border-white/5 bg-zinc-900/40 py-6">
        <div className="mx-auto max-w-7xl px-6">
          <p className="mb-4 text-center text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
            Live Dashboard Quick Nav
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {QUICK_NAV.map(({ label, href, chip }) => (
              <Link
                key={href}
                href={href}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors sm:text-sm ${chip}`}
              >
                {label}
                <ArrowRight className="h-3 w-3 opacity-60" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Complete Platform Modules */}
      <section id="modules" className="scroll-mt-20 mx-auto max-w-7xl px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/5 px-3 py-1 text-xs font-medium text-violet-300">
            <ScanSearch className="h-3.5 w-3.5" />
            All Dashboard Modules
          </div>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
            Complete Platform Modules
          </h2>
          <p className="mt-3 text-sm text-zinc-500 sm:text-base">
            Every panel in the live dashboard — from scanner onboarding to trust hub reputation,
            threat intel, and compliance.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {PLATFORM_MODULES.map(({ number, title, href, icon: Icon, border, accent, chip, bullets }) => (
            <Link
              key={href}
              href={href}
              className={`group relative overflow-hidden rounded-2xl border ${border} bg-zinc-950/60 p-6 backdrop-blur-xl transition-all hover:scale-[1.01] hover:bg-zinc-900/70 hover:shadow-lg hover:shadow-emerald-500/5`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className={`inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-zinc-900/80 ${accent}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${chip}`}>
                  Module {number}
                </span>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-zinc-50">{title}</h3>
              <ul className="mt-4 space-y-2">
                {bullets.map((bullet) => (
                  <li key={bullet} className="flex items-start gap-2 text-sm text-zinc-400">
                    <Zap className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${accent}`} />
                    {bullet}
                  </li>
                ))}
              </ul>
              <span className="mt-5 inline-flex items-center gap-1 text-xs font-medium text-emerald-400/80 group-hover:text-emerald-300">
                Open module
                <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <PlaygroundSection />
      <PricingSection />
      <LandingFooter />
    </div>
  );
}
