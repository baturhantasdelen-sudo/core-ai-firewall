import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  Copy,
  Crosshair,
  FileText,
  Fingerprint,
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
import { AttackDemo } from '@/components/landing/AttackDemo';
import { McpHijackTrajectoryDemo } from '@/components/landing/McpHijackTrajectoryDemo';
import { ContactSection } from '@/components/landing/ContactSection';
import { TrustCenterSection } from '@/components/landing/TrustCenterSection';
import { LandingFooter } from '@/components/landing/LandingFooter';
import { PublicProofCenterSection } from '@/components/landing/PublicProofCenterSection';
import { ProofCenterUarPlayground } from '@/components/proof-center/ProofCenterUarPlayground';
import { DASHBOARD_NAV_ITEMS } from '@/lib/dashboard-nav';
import {
  NEXUS_DEFENSIVE_POSITIONING,
  NEXUS_GOVERNANCE_TAGLINE,
  NEXUS_RUNTIME_FLOW_LABEL,
  NEXUS_HARNESS_LATENCY_FOOTNOTE,
  NEXUS_RUNTIME_LATENCY_METRIC,
  NEXUS_VALUE_PROP_HOOK,
} from '@/lib/brand/copy-standards';

/** Core Action Control Plane — product spine. */
const ACTION_CONTROL_PLANE = [
  {
    phase: 'SEE',
    title: 'Interception & Discovery',
    href: '/dashboard/agents',
    icon: Fingerprint,
    border: 'border-violet-500/25',
    accent: 'text-violet-400',
    chip: 'border-violet-500/20 bg-violet-500/10 text-violet-200',
    bullets: [
      'Agent & MCP inventory (LangChain, CrewAI, Assistants)',
      'Free scan funnel — Attack → Prove → Install → Protect',
      'Effective authority vs declared capabilities',
    ],
  },
  {
    phase: 'CONTROL',
    title: 'Action Firewall & Policy',
    href: '/dashboard/actions',
    icon: ShieldAlert,
    border: 'border-rose-500/25',
    accent: 'text-rose-400',
    chip: 'border-rose-500/20 bg-rose-500/10 text-rose-200',
    bullets: [
      'POST /api/v1/action/evaluate — intent divergence & BLOCK',
      'READ_ONLY / REQUIRE_APPROVAL / Kill Switch degradation',
      'Self-hosted POST /v1/intercept (air-gapped data plane)',
    ],
  },
  {
    phase: 'PROVE',
    title: 'UAR & Proof Center',
    href: '/proof-center',
    icon: ShieldCheck,
    border: 'border-emerald-500/25',
    accent: 'text-emerald-400',
    chip: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200',
    bullets: [
      'SHA-256 Universal Action Receipts on every governed attempt',
      'POST /api/v1/uar/inspect — instant developer receipt JSON',
      'Public Proof Center vs production UAR ledger (transparent lanes)',
    ],
  },
] as const;

/** Extends the control plane — not standalone product lines. */
const CONTROL_PLANE_EXTENSIONS = [
  {
    title: 'Trust Hub & Compliance',
    href: '/dashboard/trust-hub',
    icon: FileText,
    border: 'border-cyan-500/25',
    accent: 'text-cyan-400',
    chip: 'border-cyan-500/20 bg-cyan-500/10 text-cyan-200',
    bullets: ['Trajectory audit stream', 'KVKK/GDPR evidence export', 'SOC 2 / ISO reporting hooks'],
  },
  {
    title: 'Threat Intel & Red Team',
    href: '/dashboard/threat-intel',
    icon: Radar,
    border: 'border-indigo-500/25',
    accent: 'text-indigo-400',
    chip: 'border-indigo-500/20 bg-indigo-500/10 text-indigo-200',
    bullets: ['Immune memory patterns', 'Simulator & challenge engine', 'Resilience scoring'],
  },
  {
    title: 'Setup & Settings',
    href: '/dashboard',
    icon: Settings,
    border: 'border-zinc-500/25',
    accent: 'text-zinc-300',
    chip: 'border-white/10 bg-zinc-900/80 text-zinc-300',
    bullets: ['Integration checklist', 'API keys & GitHub App', 'Enterprise demo: docker compose up'],
  },
] as const;

const QUICK_NAV = [
  { label: 'Action Firewall', href: '/dashboard/actions', chip: 'border-rose-500/20 bg-rose-500/10 text-rose-200 hover:border-rose-500/40' },
  { label: 'Proof Center', href: '/proof-center', chip: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200 hover:border-emerald-500/40' },
  { label: 'Free Scan', href: '/scan', chip: 'border-violet-500/20 bg-violet-500/10 text-violet-200 hover:border-violet-500/40' },
  { label: 'Demo / UAR', href: '/demo', chip: 'border-cyan-500/20 bg-cyan-500/10 text-cyan-200 hover:border-cyan-500/40' },
  { label: 'Trust Hub', href: '/dashboard/trust-hub', chip: 'border-cyan-500/20 bg-cyan-500/10 text-cyan-200 hover:border-cyan-500/40' },
] as const;

const NAV_BUTTONS = DASHBOARD_NAV_ITEMS.filter((item) =>
  ['Action Firewall', 'Agents', 'Proof Center', 'Trust Hub', 'Setup Guide'].includes(item.label),
);

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
        <span className="text-zinc-300">API Key</span> badge · Action Control Plane shortcuts
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
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/25 bg-cyan-500/5 px-4 py-1.5 text-xs font-semibold tracking-widest text-cyan-200 backdrop-blur-sm">
              <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
              Action Control Plane
            </div>

            <h1 className="mt-8 text-4xl font-semibold tracking-tight text-zinc-50 sm:text-5xl lg:text-6xl lg:leading-[1.08]">
              {NEXUS_VALUE_PROP_HOOK}
            </h1>

            <p className="mx-auto mt-5 max-w-3xl text-lg text-zinc-300 sm:text-xl">
              Agent Action Governance &amp; Verification — not a prompt-only firewall.
            </p>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-zinc-500">{NEXUS_GOVERNANCE_TAGLINE}</p>
            <p className="mx-auto mt-3 max-w-3xl text-xs leading-relaxed text-zinc-500">
              {NEXUS_DEFENSIVE_POSITIONING}
            </p>
            <p className="mx-auto mt-2 max-w-3xl font-mono text-[11px] leading-relaxed text-cyan-400/90">
              {NEXUS_RUNTIME_FLOW_LABEL}
            </p>
            <p className="mx-auto mt-2 max-w-2xl font-mono text-xs text-emerald-300/90">
              {NEXUS_RUNTIME_LATENCY_METRIC}
            </p>

            <div className="mx-auto mt-8 max-w-3xl rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5 text-left backdrop-blur-sm">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-400/80">
                Execution → state change → cryptographic proof
              </p>
              <p className="mt-2 text-sm text-zinc-300">
                Intercept tool calls, enforce policy at the API boundary, and seal{' '}
                <strong className="font-semibold text-emerald-300">Universal Action Receipts</strong> — before/after
                state hashes and SHA-256 evidence auditors can reproduce.
              </p>
            </div>

            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:flex-wrap">
              <a
                href="#attack-simulator"
                className="group inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-rose-500 px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-orange-500/25 transition-transform hover:scale-[1.02] hover:shadow-orange-500/40 active:scale-[0.98]"
              >
                <Crosshair className="h-4 w-4" />
                SIMULATE HIJACK
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </a>
              <Link
                href="/scorecard"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-7 py-3.5 text-sm font-semibold text-zinc-950 shadow-lg shadow-emerald-500/25 transition-transform hover:scale-[1.02]"
              >
                <ShieldCheck className="h-4 w-4" />
                2026 Agent Scorecard
              </Link>
              <Link
                href="/docs/benchmark"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-7 py-3.5 text-sm font-semibold text-emerald-200 backdrop-blur-md transition hover:bg-emerald-500/20"
              >
                Reproduce MCP-SEC-SCORE
              </Link>
              <Link
                href="/docs"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-7 py-3.5 text-sm font-semibold text-zinc-200 backdrop-blur-md transition-colors hover:border-white/20 hover:bg-white/10"
              >
                <BookOpen className="h-4 w-4" />
                API Docs
              </Link>
            </div>
          </div>

          <PlatformNavPreview />

          <div className="mx-auto mt-8 grid max-w-4xl grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Action Control Plane', sub: 'SEE · CONTROL · PROVE' },
              { label: 'Open harness', sub: 'core-ai-firewall/harness' },
              { label: 'P99 6.1ms', sub: NEXUS_HARNESS_LATENCY_FOOTNOTE },
              { label: 'UAR receipts', sub: 'Tamper-evident SHA-256' },
            ].map(({ label, sub }) => (
              <div key={label} className="rounded-xl border border-white/8 bg-white/3 px-4 py-3 text-center backdrop-blur-md">
                <p className="text-sm font-semibold text-emerald-300 sm:text-base">{label}</p>
                <p className="text-[10px] text-zinc-500 sm:text-xs">{sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-emerald-500/10 bg-gradient-to-r from-emerald-950/30 via-zinc-900/50 to-cyan-950/20 py-4">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-3 px-6">
          <ScanSearch className="h-4 w-4 text-emerald-400" />
          <p className="text-sm font-medium text-zinc-300">
            Open-source MCP-SEC-SCORE benchmark — reproducible via Docker, no login required
          </p>
          <Link
            href="/docs/benchmark"
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/15 px-4 py-2 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-500/30 transition hover:bg-emerald-500/25"
          >
            Run Repro Benchmark
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </section>

      <AttackDemo />

      <McpHijackTrajectoryDemo />

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

      <section id="runtime-pillars" className="scroll-mt-20 border-y border-white/5 bg-zinc-900/30 py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/5 px-3 py-1 text-xs font-medium text-cyan-300">
              <ShieldCheck className="h-3.5 w-3.5" />
              {NEXUS_RUNTIME_FLOW_LABEL}
            </div>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
              Action Control Plane
            </h2>
            <p className="mt-3 text-sm text-zinc-500 sm:text-base">
              One engine: intercept, authorize, execute under policy, prove with UAR. Extensions (intel, red team,
              compliance) plug into this spine.
            </p>
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-2 text-xs font-semibold uppercase tracking-widest text-zinc-600">
            <span className="rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1 text-violet-400">SEE</span>
            <ArrowRight className="hidden h-4 w-4 sm:block" />
            <span className="rounded-full border border-rose-500/20 bg-rose-500/10 px-3 py-1 text-rose-400">CONTROL</span>
            <ArrowRight className="hidden h-4 w-4 sm:block" />
            <span className="rounded-full border border-zinc-500/20 bg-zinc-500/10 px-3 py-1 text-zinc-300">EXECUTE</span>
            <ArrowRight className="hidden h-4 w-4 sm:block" />
            <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-emerald-400">PROVE</span>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-3">
            {ACTION_CONTROL_PLANE.map(({ phase, title, href, icon: Icon, accent, border, chip, bullets }) => (
              <Link
                key={phase}
                href={href}
                className={`group flex h-full min-h-[280px] flex-col rounded-2xl border ${border} bg-zinc-950/60 p-6 backdrop-blur-xl transition-all hover:scale-[1.01] hover:bg-zinc-900/70 hover:shadow-lg hover:shadow-emerald-500/5`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className={`inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-zinc-900/80 ${accent}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold tracking-wider ${chip}`}>
                    {phase}
                  </span>
                </div>
                <h3 className="mt-3 text-lg font-semibold text-zinc-50">{title}</h3>
                <ul className="mt-4 flex-1 space-y-2">
                  {bullets.map((bullet) => (
                    <li key={bullet} className="flex items-start gap-1.5 text-xs text-zinc-400">
                      <Zap className={`mt-0.5 h-3 w-3 shrink-0 ${accent}`} />
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

          <div className="mt-8 flex flex-wrap items-center justify-center gap-2.5">
            {[
              { label: 'Agent Inventory', href: '/dashboard/agents' },
              { label: 'Action Firewall', href: '/dashboard/actions' },
              { label: 'Proof Center', href: '/proof-center' },
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
            Control plane extensions
          </div>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
            Built on the Action Control Plane
          </h2>
          <p className="mt-3 text-sm text-zinc-500 sm:text-base">
            Threat intel, red team, trust hub, and compliance extend governance — they are not separate security
            products.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {CONTROL_PLANE_EXTENSIONS.map(({ title, href, icon: Icon, border, accent, chip, bullets }) => (
            <Link
              key={href}
              href={href}
              className={`group flex flex-col rounded-2xl border ${border} bg-zinc-950/60 p-5 backdrop-blur-xl transition-all hover:scale-[1.01] hover:bg-zinc-900/70 hover:shadow-lg hover:shadow-emerald-500/5`}
            >
              <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-zinc-900/80 ${accent}`}>
                <Icon className="h-4 w-4" />
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

      <section id="security-engines" className="scroll-mt-20 border-t border-white/5 bg-zinc-950/80 py-16">
        <div className="mx-auto max-w-7xl px-6">
          <p className="text-center text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
            Secondary — Security Engines
          </p>
          <h2 className="mt-2 text-center text-2xl font-semibold text-zinc-100">
            Prompt &amp; PII engines (supporting layer)
          </h2>
          <p className="mx-auto mt-2 max-w-2xl text-center text-sm text-zinc-500">
            Legacy guardrails remain available; primary product value is agent action governance,
            Universal Action Receipts, and verification APIs.
          </p>
          <div className="mt-8">
            <PlaygroundSection />
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-6 py-12">
        <ProofCenterUarPlayground />
      </section>
      <PublicProofCenterSection />
      <TrustCenterSection />
      <PricingSection />
      <ContactSection />
      <LandingFooter />
    </div>
  );
}
