import Link from 'next/link';
import { LandingNav } from '@/components/landing/LandingNav';
import { LandingFooter } from '@/components/landing/LandingFooter';
import { FalseSuccessTerminal } from '@/components/landing/assurance/FalseSuccessTerminal';
import { OutcomeComparisonGrid } from '@/components/landing/assurance/OutcomeComparisonGrid';
import { VerificationStatusCards } from '@/components/landing/assurance/VerificationStatusCards';
import { AssessmentFunnel } from '@/components/assessment/AssessmentFunnel';
import {
  NEXUS_CORE_LOOP_LABEL,
  NEXUS_MANIFESTO,
  NEXUS_PRODUCT_CATEGORY,
  NEXUS_VALUE_PROP_HOOK,
  NEXUS_VALUE_PROP_SUBTITLE,
  NEXUS_VERIFY_WORLD,
} from '@/lib/brand/copy-standards';
import { NEXUS_PRIMARY_CTA } from '@/lib/site-navigation';

const FRAMEWORK = [
  { phase: 'SEE', title: 'Discovery', body: 'Agents, identities, delegation, MCP tools, effective authority.' },
  { phase: 'CONTROL', title: 'Control', body: 'Intent, policy, action firewall, risk, revocation, human approval.' },
  { phase: 'VERIFY', title: 'Verification', body: 'Action & outcome verification, side-effects, false-success detection.' },
  { phase: 'PROVE', title: 'Proof', body: 'UAR 2.0, evidence chain, Proof Center export, independent verify CLI.' },
];

const ECOSYSTEM = [
  'Microsoft / Dynamics 365 / MCP',
  'OpenAI',
  'Anthropic',
  'Salesforce',
  'SAP',
  'Oracle',
  'Palo Alto Networks',
  'AWS & Google Cloud',
];

export function AssuranceHomePage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <LandingNav />

      {/* Hero */}
      <section className="border-b border-white/5">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-16 lg:grid-cols-2 lg:py-24">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-400">{NEXUS_PRODUCT_CATEGORY}</p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-zinc-50 sm:text-5xl">{NEXUS_VALUE_PROP_HOOK}</h1>
            <p className="mt-4 text-lg text-zinc-400">{NEXUS_VALUE_PROP_SUBTITLE}</p>
            <p className="mt-3 text-sm text-zinc-500">{NEXUS_MANIFESTO}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href={NEXUS_PRIMARY_CTA.href}
                className="rounded-lg bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-cyan-500"
              >
                {NEXUS_PRIMARY_CTA.label}
              </Link>
              <Link
                href="/platform/outcome-verification"
                className="rounded-lg border border-white/15 px-5 py-2.5 text-sm font-medium text-zinc-200 hover:border-white/25"
              >
                Explore the Platform
              </Link>
            </div>
            <p className="mt-6 font-mono text-[11px] text-zinc-600">{NEXUS_VERIFY_WORLD}</p>
          </div>
          <FalseSuccessTerminal />
        </div>
      </section>

      {/* Framework */}
      <section className="border-b border-white/5 py-16">
        <div className="mx-auto max-w-7xl px-6">
          <h2 className="text-center text-2xl font-semibold text-zinc-50">{NEXUS_CORE_LOOP_LABEL}</h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FRAMEWORK.map((c) => (
              <article key={c.phase} className="rounded-xl border border-white/10 bg-zinc-900/40 p-5">
                <span className="text-[10px] font-bold tracking-widest text-cyan-400">{c.phase}</span>
                <h3 className="mt-2 font-semibold text-zinc-100">{c.title}</h3>
                <p className="mt-2 text-sm text-zinc-400">{c.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Outcome star */}
      <section className="border-b border-white/5 py-16">
        <div className="mx-auto max-w-7xl px-6">
          <h2 className="text-2xl font-semibold text-zinc-50">An API response is not proof of success.</h2>
          <p className="mt-2 max-w-2xl text-sm text-zinc-400">
            Compare expected vs. actual using authoritative reads — not agent or tool narratives.
          </p>
          <div className="mt-8">
            <OutcomeComparisonGrid />
          </div>
        </div>
      </section>

      {/* Statuses */}
      <section className="border-b border-white/5 py-16">
        <div className="mx-auto max-w-7xl px-6">
          <h2 className="text-2xl font-semibold text-zinc-50">Four universal verification statuses</h2>
          <div className="mt-8">
            <VerificationStatusCards />
          </div>
        </div>
      </section>

      {/* Proof Center demo */}
      <section className="border-b border-white/5 py-16">
        <div className="mx-auto max-w-7xl px-6">
          <div className="rounded-2xl border border-white/10 bg-zinc-900/50 p-6 sm:p-8">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-200">Demo proof record</span>
            <h2 className="mt-2 text-xl font-semibold">Proof #NSX-8291</h2>
            <ul className="mt-4 space-y-2 text-sm text-zinc-400">
              <li>Payment provider — authoritative read ✓ (example)</li>
              <li>ERP invoice state — authoritative read ✓ (example)</li>
              <li>Ledger entry hash — SHA-256 ✓ (example)</li>
            </ul>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/platform/proof-center" className="rounded-lg border border-white/15 px-4 py-2 text-sm text-zinc-200">
                View Proof Center
              </Link>
              <Link href="/assurance/uar-receipts" className="rounded-lg border border-white/15 px-4 py-2 text-sm text-zinc-200">
                Verify with CLI
              </Link>
              <Link href="/proof-center" className="rounded-lg border border-cyan-500/30 px-4 py-2 text-sm text-cyan-200">
                Live product UI
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* A2B */}
      <section className="border-b border-white/5 py-16">
        <div className="mx-auto max-w-7xl px-6">
          <h2 className="text-2xl font-semibold text-zinc-50">Independent Agent Action Assurance Benchmark (A2B)</h2>
          <p className="mt-2 max-w-3xl text-sm text-zinc-400">
            Open fixtures in{' '}
            <code className="text-cyan-400/90">lib/nexus-core/benchmark/</code> — reproducible via{' '}
            <code className="text-cyan-400/90">npm run test:benchmark</code>.
          </p>
          <dl className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
              <dt className="text-xs text-zinc-500">Measured (CI suite)</dt>
              <dd className="text-lg font-semibold text-emerald-200">20 / 20 scenarios PASS</dd>
            </div>
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
              <dt className="text-xs text-zinc-500">False success detection (fixtures)</dt>
              <dd className="text-lg font-semibold text-emerald-200">100% on A2B false-success cases</dd>
            </div>
            <div className="rounded-xl border border-white/10 bg-zinc-900/40 p-4">
              <dt className="text-xs text-zinc-500">Weighting (methodology)</dt>
              <dd className="text-sm text-zinc-300">Outcome integrity 30% · see methodology page</dd>
            </div>
          </dl>
          <Link href="/assurance/benchmark" className="mt-6 inline-flex text-sm font-medium text-cyan-400 hover:text-cyan-300">
            Read A2B methodology →
          </Link>
        </div>
      </section>

      {/* Ecosystem */}
      <section className="border-b border-white/5 py-16">
        <div className="mx-auto max-w-7xl px-6 text-center">
          <h2 className="text-2xl font-semibold text-zinc-50">Works alongside your stack</h2>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-zinc-500">
            Compatible with — not a replacement for — your ERP, CRM, IAM, cloud, and security platforms. Nexus verifies
            consequential outcomes independently.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            {ECOSYSTEM.map((name) => (
              <span key={name} className="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-400">
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Funnel */}
      <section id="assessment" className="py-16">
        <div className="mx-auto max-w-xl px-6">
          <h2 className="text-center text-2xl font-semibold text-zinc-50">Free Agent Assurance Assessment</h2>
          <p className="mt-2 text-center text-sm text-zinc-500">ESTIMATE report — demo lead funnel, not a live audit.</p>
          <div className="mt-8">
            <AssessmentFunnel />
          </div>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}
