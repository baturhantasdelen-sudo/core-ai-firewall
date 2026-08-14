import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  Bot,
  Copy,
  Crosshair,
  Eye,
  FileText,
  KeyRound,
  Radar,
  ScanSearch,
  Settings,
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
    title: 'Setup Guide',
    href: '/dashboard',
    icon: BookOpen,
    border: 'border-zinc-500/25',
    accent: 'text-zinc-300',
    chip: 'border-white/10 bg-zinc-900/80 text-zinc-300',
    bullets: [
      'Quick integration & GitHub App onboarding',
      'Active secret validation & VS Code extension',
      'Scanner hub with SARIF & auto-fix previews',
    ],
  },
  {
    number: '2',
    title: 'Agents',
    href: '/dashboard/agents',
    icon: Bot,
    border: 'border-violet-500/25',
    accent: 'text-violet-400',
    chip: 'border-violet-500/20 bg-violet-500/10 text-violet-200',
    bullets: [
      'LangChain, LlamaIndex, CrewAI & MCP discovery',
      'OpenAI Assistants tool capability mapping',
      'Per-agent risk scoring inventory',
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
      'Instant Kill Switch session freeze',
    ],
  },
  {
    number: '4',
    title: 'Threat Intel',
    href: '/dashboard/threat-intel',
    icon: Radar,
    border: 'border-indigo-500/25',
    accent: 'text-indigo-400',
    chip: 'border-indigo-500/20 bg-indigo-500/10 text-indigo-200',
    bullets: [
      'Zero-Knowledge signatures (#TS-xxxx)',
      'Global immune memory sync',
      'Collective threat pattern matching',
    ],
  },
  {
    number: '5',
    title: 'Red Teaming',
    href: '/dashboard/simulator',
    icon: Crosshair,
    border: 'border-orange-500/25',
    accent: 'text-orange-400',
    chip: 'border-orange-500/20 bg-orange-500/10 text-orange-200',
    bullets: [
      '5 synthetic attack vectors per agent',
      'Resilience score (0–100) reporting',
      'Live red-team console replay',
    ],
  },
  {
    number: '6',
    title: 'Trust Hub',
    href: '/dashboard/trust-hub',
    icon: ShieldCheck,
    border: 'border-cyan-500/25',
    accent: 'text-cyan-400',
    chip: 'border-cyan-500/20 bg-cyan-500/10 text-cyan-200',
    bullets: [
      'Tool-Chain trajectory enforcement',
      'Evidence Chain verification',
      'Memory poisoning guard & reputation',
    ],
  },
  {
    number: '7',
    title: 'Compliance',
    href: '/dashboard/compliance',
    icon: FileText,
    border: 'border-indigo-500/25',
    accent: 'text-indigo-300',
    chip: 'border-indigo-500/20 bg-indigo-500/10 text-indigo-200',
    bullets: [
      'KVKK/GDPR PDF audit reports',
      'Policy management & masking stats',
      'Executive compliance grades',
    ],
  },
  {
    number: '8',
    title: 'Settings',
    href: '/dashboard/settings',
    icon: Settings,
    border: 'border-zinc-500/25',
    accent: 'text-zinc-300',
    chip: 'border-white/10 bg-zinc-900/80 text-zinc-300',
    bullets: [
      'API key & org configuration',
      'Billing & plan management',
      'GitHub App connection settings',
    ],
  },
] as const;

const QUICK_NAV = [
  { label: 'Setup Guide', href: '/dashboard', chip: 'border-white/10 bg-zinc-900/80 text-zinc-300 hover:border-white/20' },
  { label: 'Agents', href: '/dashboard/agents', chip: 'border-violet-500/20 bg-violet-500/10 text-violet-200 hover:border-violet-500/40' },
  { label: 'Action Firewall', href: '/dashboard/actions', chip: 'border-rose-500/20 bg-rose-500/10 text-rose-200 hover:border-rose-500/40' },
  { label: 'Threat Intel', href: '/dashboard/threat-intel', chip: 'border-indigo-500/20 bg-indigo-500/10 text-indigo-200 hover:border-indigo-500/40' },
  { label: 'Red Teaming', href: '/dashboard/simulator', chip: 'border-orange-500/20 bg-orange-500/10 text-orange-200 hover:border-orange-500/40' },
  { label: 'Trust Hub', href: '/dashboard/trust-hub', chip: 'border-cyan-500/20 bg-cyan-500/10 text-cyan-200 hover:border-cyan-500/40' },
  { label: 'Compliance', href: '/dashboard/compliance', chip: 'border-indigo-500/20 bg-indigo-500/10 text-indigo-200 hover:border-indigo-500/40' },
  { label: 'Settings', href: '/dashboard/settings', chip: 'border-white/10 bg-zinc-900/80 text-zinc-300 hover:border-white/20' },
] as const;

const TRUST_LAYERS = [
  {
    phase: 'SEE',
    title: 'Visibility, Discovery & Effective Authority',
    subtitle: 'Katman 1',
    href: '/dashboard/agents',
    icon: Eye,
    accent: 'text-violet-400',
    border: 'border-violet-500/25',
    chip: 'border-violet-500/20 bg-violet-500/10 text-violet-200',
    bullets: [
      'Agent & MCP discovery across LangChain, CrewAI, OpenAI Assistants',
      'Effective Authority matrix — API keys & OAuth scopes vs declared caps',
      'Unrestricted Write/Delete & Financial Access risk badges',
    ],
  },
  {
    phase: 'CONTROL',
    title: 'Action Firewall, Intent Divergence & Capability Revocation',
    subtitle: 'Katman 2',
    href: '/dashboard/actions',
    icon: ShieldAlert,
    accent: 'text-rose-400',
    border: 'border-rose-500/25',
    chip: 'border-rose-500/20 bg-rose-500/10 text-rose-200',
    bullets: [
      'Intent vs. Action trajectory divergence scoring',
      'INTENT_ACTION_DIVERGENCE block at >80% mismatch',
      'revokeCapabilities() read-only mode instead of full kill switch',
    ],
  },
  {
    phase: 'TRUST',
    title: 'Evidence Chain & Digital Immune System',
    subtitle: 'Katman 3',
    href: '/dashboard/trust-hub',
    icon: ShieldCheck,
    accent: 'text-cyan-400',
    border: 'border-cyan-500/25',
    chip: 'border-cyan-500/20 bg-cyan-500/10 text-cyan-200',
    bullets: [
      'ERP Transaction ID · DB Modification Hash · Log Diff verification',
      'UNVERIFIED_ACTION flag for evidence-less critical ops',
      'SAFE-compliant Zero-Knowledge immune signatures (#TS-xxxx)',
    ],
  },
] as const;

const NAV_BUTTONS = [
  { label: 'Setup Guide', icon: BookOpen, chip: 'border-white/10 bg-zinc-900/80 text-zinc-300' },
  { label: 'Agents', icon: Bot, chip: 'border-violet-500/20 bg-violet-500/10 text-violet-200' },
  { label: 'Action Firewall', icon: ShieldAlert, chip: 'border-rose-500/20 bg-rose-500/10 text-rose-200' },
  { label: 'Threat Intel', icon: Radar, chip: 'border-indigo-500/20 bg-indigo-500/10 text-indigo-200' },
  { label: 'Red Teaming', icon: Crosshair, chip: 'border-orange-500/20 bg-orange-500/10 text-orange-200' },
  { label: 'Trust Hub', icon: ShieldCheck, chip: 'border-cyan-500/20 bg-cyan-500/10 text-cyan-200' },
  { label: 'Compliance', icon: FileText, chip: 'border-indigo-500/20 bg-indigo-500/10 text-indigo-200' },
  { label: 'Settings', icon: Settings, chip: 'border-white/10 bg-zinc-900/80 text-zinc-300' },
] as const;

function PlatformNavPreview() {
  return (
    <div className="mx-auto mt-10 max-w-6xl overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/60 p-4 shadow-2xl shadow-emerald-500/5 backdrop-blur-xl sm:p-5">
      <p className="mb-4 text-center text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
        Platform Nav Preview — Live Dashboard Header
      </p>

      <div className="space-y-4 rounded-xl border border-white/5 bg-zinc-950/50 p-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <BrandLogo size={32} />
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="select-none text-lg font-semibold tracking-tight text-zinc-100 sm:text-xl">
              Nexus Shield Dashboard
            </span>
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.3)]">
              <span className="relative flex h-1.5 w-1.5 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </span>
              Telemetry Active
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 shadow-[0_0_10px_rgba(52,211,153,0.12)]">
            <KeyRound className="h-3.5 w-3.5 text-emerald-400" />
            <code className="font-mono text-[10px] text-zinc-300 sm:text-xs">nex_••••••••••••4421</code>
            <Copy className="h-3.5 w-3.5 text-zinc-500" aria-hidden />
          </div>

          {NAV_BUTTONS.map(({ label, icon: Icon, chip }) => (
            <span
              key={label}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium sm:text-xs ${chip}`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              {label}
            </span>
          ))}
        </div>
      </div>

      <p className="mt-3 text-center text-[11px] text-zinc-500">
        <span className="text-emerald-400">Telemetry Active</span> live signal ·{' '}
        <span className="text-zinc-300">API Key</span> badge · 8 module shortcuts
      </p>
    </div>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <LandingNav />

      <section className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute left-1/2 top-[-12rem] h-[40rem] w-[40rem] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute right-[-8rem] top-24 h-[28rem] w-[28rem] rounded-full bg-violet-500/10 blur-3xl" />

        <div className="relative mx-auto max-w-6xl px-6 py-16 sm:py-24">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-4 py-1.5 text-xs font-medium text-emerald-300 backdrop-blur-sm">
              <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
              2026 AI Agent Trust &amp; Runtime Security
            </div>

            <h1 className="mt-8 text-4xl font-semibold tracking-tight text-zinc-50 sm:text-5xl lg:text-6xl lg:leading-[1.08]">
              THE RUNTIME SECURITY &amp;{' '}
              <span className="bg-gradient-to-r from-emerald-400 via-cyan-400 to-violet-400 bg-clip-text text-transparent">
                TRUST LAYER FOR AI AGENTS
              </span>
            </h1>

            <p className="mt-5 text-lg font-medium text-emerald-200/90 sm:text-xl">
              Discover every agent. Control every action. Verify every outcome.
            </p>

            <p className="mx-auto mt-4 max-w-2xl text-base text-zinc-400 sm:text-lg">
              SEE → CONTROL → TRUST — three runtime layers that give every autonomous agent an identity,
              enforce intent-aligned actions, and prove critical executions with verifiable evidence.
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/dashboard"
                className="group inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-7 py-3.5 text-sm font-semibold text-zinc-950 shadow-lg shadow-emerald-500/25 transition-transform hover:scale-[1.02] hover:shadow-emerald-500/40 active:scale-[0.98]"
              >
                <ScanSearch className="h-4 w-4" />
                Scan Your AI Environment
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/dashboard/simulator"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-orange-500/25 bg-orange-500/5 px-7 py-3.5 text-sm font-semibold text-orange-100 backdrop-blur-md transition-colors hover:border-orange-500/40 hover:bg-orange-500/10"
              >
                <Crosshair className="h-4 w-4" />
                Simulate Agent Attack
              </Link>
            </div>
          </div>

          <PlatformNavPreview />

          <div className="mx-auto mt-8 grid max-w-4xl grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: '8 Modules', sub: 'Full platform stack' },
              { label: 'Telemetry', sub: 'Live green signal' },
              { label: 'Sub-10ms', sub: 'Runtime intercept' },
              { label: 'API Key', sub: 'Secure badge' },
            ].map(({ label, sub }) => (
              <div key={label} className="rounded-xl border border-white/8 bg-white/3 px-4 py-3 text-center backdrop-blur-md">
                <p className="text-sm font-semibold text-emerald-300 sm:text-base">{label}</p>
                <p className="text-[10px] text-zinc-500 sm:text-xs">{sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-white/5 bg-zinc-900/40 py-6">
        <div className="mx-auto max-w-7xl px-6">
          <p className="mb-4 text-center text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
            Live Dashboard Quick Nav
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2.5">
            {QUICK_NAV.map(({ label, href, chip }) => (
              <Link
                key={href}
                href={href}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors sm:text-sm ${chip}`}
              >
                {label}
                <ArrowRight className="h-3 w-3 opacity-60" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section id="trust-layers" className="scroll-mt-20 border-y border-white/5 bg-zinc-900/30 py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/5 px-3 py-1 text-xs font-medium text-cyan-300">
              <ShieldCheck className="h-3.5 w-3.5" />
              SEE → CONTROL → TRUST
            </div>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
              Three-Layer Runtime Architecture
            </h2>
            <p className="mt-3 text-sm text-zinc-500 sm:text-base">
              From discovery to enforcement to verification — each layer maps to live dashboard modules.
            </p>
          </div>

          <div className="mt-10 hidden items-center justify-center gap-2 text-xs font-semibold uppercase tracking-widest text-zinc-600 sm:flex">
            <span className="text-violet-400">SEE</span>
            <ArrowRight className="h-4 w-4" />
            <span className="text-rose-400">CONTROL</span>
            <ArrowRight className="h-4 w-4" />
            <span className="text-cyan-400">TRUST</span>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-3">
            {TRUST_LAYERS.map(({ phase, title, subtitle, href, icon: Icon, accent, border, chip, bullets }) => (
              <Link
                key={phase}
                href={href}
                className={`group flex flex-col rounded-2xl border ${border} bg-zinc-950/60 p-6 backdrop-blur-xl transition-all hover:scale-[1.01] hover:bg-zinc-900/70 hover:shadow-lg hover:shadow-emerald-500/5`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className={`inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-zinc-900/80 ${accent}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold tracking-wider ${chip}`}>
                    {phase}
                  </span>
                </div>
                <p className="mt-3 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">{subtitle}</p>
                <h3 className="mt-1 text-lg font-semibold text-zinc-50">{title}</h3>
                <ul className="mt-4 flex-1 space-y-2">
                  {bullets.map((bullet) => (
                    <li key={bullet} className="flex items-start gap-1.5 text-xs text-zinc-400">
                      <Zap className={`mt-0.5 h-3 w-3 shrink-0 ${accent}`} />
                      {bullet}
                    </li>
                  ))}
                </ul>
                <span className="mt-5 inline-flex items-center gap-1 text-xs font-medium text-emerald-400/80 group-hover:text-emerald-300">
                  Open live dashboard
                  <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-2.5">
            {[
              { label: 'Agent Inventory', href: '/dashboard/agents' },
              { label: 'Action Firewall', href: '/dashboard/actions' },
              { label: 'Threat Intel', href: '/dashboard/threat-intel' },
              { label: 'Trust Hub', href: '/dashboard/trust-hub' },
              { label: 'Red Team Simulator', href: '/dashboard/simulator' },
            ].map(({ label, href }) => (
              <Link
                key={href}
                href={href}
                className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-zinc-900/60 px-3 py-1.5 text-xs text-zinc-300 transition hover:border-emerald-500/30 hover:text-emerald-300"
              >
                {label}
                <ArrowRight className="h-3 w-3 opacity-50" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section id="modules" className="scroll-mt-20 mx-auto max-w-7xl px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/5 px-3 py-1 text-xs font-medium text-violet-300">
            <ScanSearch className="h-3.5 w-3.5" />
            8 Dashboard Modules
          </div>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
            Complete Platform Modules
          </h2>
          <p className="mt-3 text-sm text-zinc-500 sm:text-base">
            Every panel from the live header — Setup Guide through Settings, with direct dashboard links.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {PLATFORM_MODULES.map(({ number, title, href, icon: Icon, border, accent, chip, bullets }) => (
            <Link
              key={href}
              href={href}
              className={`group flex flex-col rounded-2xl border ${border} bg-zinc-950/60 p-5 backdrop-blur-xl transition-all hover:scale-[1.01] hover:bg-zinc-900/70 hover:shadow-lg hover:shadow-emerald-500/5`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-zinc-900/80 ${accent}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${chip}`}>
                  {number}
                </span>
              </div>
              <h3 className="mt-3 text-base font-semibold text-zinc-50">{title}</h3>
              <ul className="mt-3 flex-1 space-y-1.5">
                {bullets.map((bullet) => (
                  <li key={bullet} className="flex items-start gap-1.5 text-xs text-zinc-400">
                    <Zap className={`mt-0.5 h-3 w-3 shrink-0 ${accent}`} />
                    {bullet}
                  </li>
                ))}
              </ul>
              <span className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-emerald-400/80 group-hover:text-emerald-300">
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
