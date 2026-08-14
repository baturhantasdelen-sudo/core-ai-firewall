import Link from 'next/link';
import {
  ArrowRight,
  Bot,
  Radar,
  ScanSearch,
  Shield,
  ShieldAlert,
  Sparkles,
  Zap,
} from 'lucide-react';
import { PlaygroundSection } from '@/components/playground/PlaygroundSection';
import { PricingSection } from '@/components/pricing/PricingSection';
import { LandingNav } from '@/components/landing/LandingNav';
import { LandingFooter } from '@/components/landing/LandingFooter';

const PILLARS = [
  {
    phase: 'Pillar 1',
    title: 'Static Gateway & Secret Validation',
    icon: ScanSearch,
    accent: 'from-cyan-500/20 to-emerald-500/10',
    border: 'border-cyan-500/25',
    iconColor: 'text-cyan-400',
    glow: 'shadow-cyan-500/10',
    bullets: [
      'Context-Aware AI false-positive filtering',
      'Active secret validation (live key probes)',
      'Auto-Fix PRs with SARIF 2.1.0 remediation',
    ],
  },
  {
    phase: 'Pillar 2',
    title: 'AI Agent & MCP Discovery Engine',
    icon: Bot,
    accent: 'from-emerald-500/20 to-teal-500/10',
    border: 'border-emerald-500/25',
    iconColor: 'text-emerald-400',
    glow: 'shadow-emerald-500/10',
    bullets: [
      'Auto-discover LangChain, LlamaIndex & CrewAI agents',
      'OpenAI Assistants & MCP server tool mapping',
      'Capability risk scoring per agent inventory',
    ],
  },
  {
    phase: 'Pillar 3',
    title: 'Action Firewall & Kill Switch',
    icon: ShieldAlert,
    accent: 'from-teal-500/20 to-cyan-500/10',
    border: 'border-teal-500/25',
    iconColor: 'text-teal-400',
    glow: 'shadow-teal-500/10',
    bullets: [
      'Intent vs. Action consistency engine',
      'Sub-10ms tool call interception at runtime',
      'Instant agent session freeze on critical risk',
    ],
  },
  {
    phase: 'Pillar 4',
    title: 'Collective Behavioral Immune Network',
    icon: Radar,
    accent: 'from-green-500/20 to-cyan-500/10',
    border: 'border-green-500/25',
    iconColor: 'text-green-400',
    glow: 'shadow-green-500/10',
    bullets: [
      'Zero-Knowledge threat signatures (#TS-xxxx)',
      'Global immune memory sync across the fleet',
      '+40 risk boost on matched collective patterns',
    ],
  },
] as const;

const DASHBOARD_MODULES = [
  {
    title: 'Scan Hub',
    description: 'Secret/PII scan history, SARIF findings & auto-fix previews',
    href: '/dashboard',
    icon: ScanSearch,
    accent: 'text-cyan-400',
    border: 'hover:border-cyan-500/40',
  },
  {
    title: 'Agent Inventory',
    description: 'LangChain, CrewAI, OpenAI Assistants & MCP capability map',
    href: '/dashboard/agents',
    icon: Bot,
    accent: 'text-emerald-400',
    border: 'hover:border-emerald-500/40',
  },
  {
    title: 'Action Firewall Logs',
    description: 'Intent-Action evaluations, kill switch events & risk scores',
    href: '/dashboard/actions',
    icon: ShieldAlert,
    accent: 'text-teal-400',
    border: 'hover:border-teal-500/40',
  },
  {
    title: 'Threat Intelligence',
    description: 'Collective immune signatures & blocked attack categories',
    href: '/dashboard/threat-intel',
    icon: Radar,
    accent: 'text-green-400',
    border: 'hover:border-green-500/40',
  },
] as const;

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <LandingNav />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-[-12rem] h-[40rem] w-[40rem] -translate-x-1/2 rounded-full bg-cyan-500/15 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute right-[-8rem] top-24 h-[28rem] w-[28rem] rounded-full bg-emerald-500/10 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-0 left-[-6rem] h-[20rem] w-[20rem] rounded-full bg-green-500/8 blur-3xl"
        />

        <div className="relative mx-auto max-w-5xl px-6 py-20 text-center sm:py-28">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/5 px-4 py-1.5 text-xs font-medium text-cyan-300 backdrop-blur-sm">
            <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
            4 Pillars of AI Agent Security
          </div>

          <h1 className="mt-8 text-4xl font-semibold tracking-tight text-zinc-50 sm:text-5xl lg:text-6xl lg:leading-[1.08]">
            Nexus Shield —{' '}
            <span className="bg-gradient-to-r from-cyan-400 via-emerald-400 to-green-400 bg-clip-text text-transparent">
              AI Agent Trust &amp; Runtime Security Platform
            </span>
          </h1>

          <p className="mt-5 text-lg font-medium text-cyan-200/90 sm:text-xl">
            Give every AI agent an identity, a reputation, and a limit.
          </p>

          <p className="mx-auto mt-4 max-w-2xl text-base text-zinc-400 sm:text-lg">
            Discover every agent. Control every action. Learn from every threat.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/dashboard"
              className="group inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 px-7 py-3.5 text-sm font-semibold text-zinc-950 shadow-lg shadow-cyan-500/25 transition-transform hover:scale-[1.02] hover:shadow-cyan-500/40 active:scale-[0.98]"
            >
              Launch Live Dashboard
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/dashboard/agents"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-500/25 bg-cyan-500/5 px-7 py-3.5 text-sm font-semibold text-cyan-100 backdrop-blur-md transition-colors hover:border-cyan-500/40 hover:bg-cyan-500/10"
            >
              <Bot className="h-4 w-4" />
              Explore Agent Inventory
            </Link>
          </div>

          <div className="mx-auto mt-12 grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              { label: 'Sub-10ms', sub: 'Runtime interception' },
              { label: '4 Pillars', sub: 'End-to-end security' },
              { label: '#TS-xxxx', sub: 'Collective immunity' },
            ].map(({ label, sub }) => (
              <div
                key={label}
                className="rounded-xl border border-white/8 bg-white/3 px-4 py-3 backdrop-blur-md"
              >
                <p className="text-lg font-semibold text-cyan-300">{label}</p>
                <p className="text-xs text-zinc-500">{sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4 Pillars */}
      <section id="pillars" className="scroll-mt-20 mx-auto max-w-7xl px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-3 py-1 text-xs font-medium text-emerald-300">
            <Shield className="h-3.5 w-3.5" />
            Platform Architecture
          </div>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
            4 Pillars of AI Agent Security
          </h2>
          <p className="mt-3 text-sm text-zinc-500 sm:text-base">
            From static scanning to collective behavioral immunity — one platform for the entire
            agent lifecycle.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2">
          {PILLARS.map(({ phase, title, icon: Icon, accent, border, iconColor, glow, bullets }) => (
            <article
              key={phase}
              className={`group relative overflow-hidden rounded-2xl border ${border} bg-gradient-to-br ${accent} p-6 backdrop-blur-xl transition-all hover:scale-[1.01] hover:shadow-lg ${glow}`}
            >
              <div className="absolute inset-0 bg-zinc-950/40 backdrop-blur-sm" />
              <div className="relative">
                <div className="flex items-start justify-between gap-4">
                  <div className={`inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-zinc-900/60 ${iconColor}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="rounded-full border border-white/10 bg-zinc-900/60 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                    {phase}
                  </span>
                </div>
                <h3 className="mt-4 text-lg font-semibold text-zinc-50">{title}</h3>
                <ul className="mt-4 space-y-2">
                  {bullets.map((bullet) => (
                    <li key={bullet} className="flex items-start gap-2 text-sm text-zinc-400">
                      <Zap className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${iconColor}`} />
                      {bullet}
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Dashboard Quick Nav */}
      <section id="dashboard-modules" className="scroll-mt-20 border-y border-white/5 bg-zinc-900/30 py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
              Live Dashboard Modules
            </h2>
            <p className="mt-3 text-sm text-zinc-500 sm:text-base">
              Jump directly into production runtime panels — scan, discover, intercept, and immunize.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {DASHBOARD_MODULES.map(({ title, description, href, icon: Icon, accent, border }) => (
              <Link
                key={href}
                href={href}
                className={`group flex flex-col rounded-2xl border border-white/10 bg-zinc-950/60 p-5 backdrop-blur-xl transition-all hover:bg-zinc-900/80 ${border} hover:shadow-lg hover:shadow-cyan-500/5`}
              >
                <div className="flex items-center justify-between">
                  <div className={`inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-zinc-900/80 ${accent}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-zinc-600 transition-transform group-hover:translate-x-0.5 group-hover:text-cyan-400" />
                </div>
                <h3 className="mt-4 text-sm font-semibold text-zinc-100">{title}</h3>
                <p className="mt-2 flex-1 text-xs leading-relaxed text-zinc-500">{description}</p>
                <span className="mt-4 text-xs font-medium text-cyan-400/80 group-hover:text-cyan-300">
                  Open module →
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <PlaygroundSection />
      <PricingSection />
      <LandingFooter />
    </div>
  );
}
