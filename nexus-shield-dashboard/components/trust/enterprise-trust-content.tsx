import Link from 'next/link';
import {
  BookOpen,
  Box,
  CloudOff,
  Container,
  FileCheck,
  FlaskConical,
  KeyRound,
  Lock,
  Server,
  ShieldCheck,
} from 'lucide-react';

const REPO_DOCS =
  'https://github.com/baturhantasdelen-sudo/core-ai-firewall/blob/main/docs';

export function EnterpriseTrustContent({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? 'space-y-10' : 'space-y-16'}>
      <section className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6 sm:p-8">
        <div className="flex flex-wrap items-start gap-3">
          <CloudOff className="h-8 w-8 shrink-0 text-emerald-400" />
          <div>
            <h2 className="text-xl font-semibold text-zinc-100 sm:text-2xl">
              Air-gapped · Zero-telemetry by default
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-400">
              Prompts, tool arguments, and action payloads are evaluated inside{' '}
              <strong className="font-medium text-zinc-200">your</strong> VPC, cluster, or on-prem
              boundary. The data plane does not require Nexus Cloud, third-party LLM APIs, or outbound
              product telemetry for governance decisions and UAR sealing.
            </p>
            <p className="mt-3 text-sm font-medium text-emerald-200/90">
              Nexus Shield never exfiltrates prompt or action payload data to Nexus-operated systems.
            </p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-zinc-100">Governance flow (customer boundary)</h2>
        <p className="mt-2 max-w-3xl text-sm text-zinc-500">
          Every governed attempt follows the same isolated pipeline; Security Engines are optional
          supporting layers, not a substitute for action receipts.
        </p>
        <pre className="mt-4 overflow-x-auto rounded-xl border border-white/10 bg-zinc-950 p-4 text-xs leading-relaxed text-zinc-300 sm:text-sm">
{`┌────────────────── Customer infrastructure (air-gap capable) ──────────────────┐
│                                                                                 │
│  Agent ──► Intent ──► Authority ──► Policy ──► Decision ──► Action ──► UAR     │
│            (declare)   (RBAC)      (engine)   (ALLOW/…)   (execute)  (SHA-256) │
│                                                                                 │
│  ◄── No required egress to Nexus Cloud · optional local LLM only ──►           │
└─────────────────────────────────────────────────────────────────────────────────┘`}
        </pre>
        <p className="mt-3 text-xs text-zinc-500">
          Deep dive:{' '}
          <a
            href={`${REPO_DOCS}/architecture-whitepaper.md`}
            className="text-indigo-400 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Architecture whitepaper
          </a>
          {' · '}
          <a
            href={`${REPO_DOCS}/DATA_PLANE_AND_CONTROL_PLANE.md`}
            className="text-indigo-400 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Data plane vs control plane
          </a>
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-zinc-100">Deployment experience</h2>
        <div className="mt-6 grid gap-5 md:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-zinc-900/50 p-5">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
              <Server className="h-5 w-5" />
            </div>
            <h3 className="mt-3 text-sm font-semibold text-zinc-100">Helm &amp; Kubernetes</h3>
            <p className="mt-2 text-sm text-zinc-500">
              One <code className="text-zinc-300">helm upgrade --install</code> deploys the Fast API
              governance plane, optional ML security engine, ingress, and health probes — suitable for
              EKS, AKS, GKE, and private clusters (GitOps / Operator-style lifecycle via Helm +
              ExternalSecrets).
            </p>
            <a
              href={`${REPO_DOCS}/ENTERPRISE_HELM_DEPLOY.md`}
              className="mt-3 inline-block text-xs font-medium text-indigo-400 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Enterprise Helm guide →
            </a>
          </div>
          <div className="rounded-xl border border-white/10 bg-zinc-900/50 p-5">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400">
              <Container className="h-5 w-5" />
            </div>
            <h3 className="mt-3 text-sm font-semibold text-zinc-100">Docker Compose (fast PoC)</h3>
            <p className="mt-2 text-sm text-zinc-500">
              Reference stack <code className="text-zinc-300">nexus-reference-app</code> and{' '}
              <code className="text-zinc-300">docker-compose.nexus-reference.yml</code> spin up the
              sidecar, mock MCP, and policy path in minutes for labs and light deployments.
            </p>
            <a
              href={`${REPO_DOCS}/QUICKSTART_DEVELOPER.md`}
              className="mt-3 inline-block text-xs font-medium text-cyan-400 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Developer quick start →
            </a>
          </div>
          <div className="rounded-xl border border-white/10 bg-zinc-900/50 p-5">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
              <KeyRound className="h-5 w-5" />
            </div>
            <h3 className="mt-3 text-sm font-semibold text-zinc-100">Secret management</h3>
            <p className="mt-2 text-sm text-zinc-500">
              API keys and sensitive config bind to Kubernetes Secrets, HashiCorp Vault (External
              Secrets Operator), or AWS Secrets Manager via the same ESO pattern — never committed to
              git.
            </p>
            <a
              href="https://github.com/baturhantasdelen-sudo/core-ai-firewall/blob/main/deploy/helm/nexus-shield/values.yaml"
              className="mt-3 inline-block text-xs font-medium text-amber-400 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Helm values (externalSecrets) →
            </a>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-zinc-100">Four security signals (low cost, high trust)</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <SignalCard
            icon={Lock}
            title="Data privacy commitment"
            body="Nexus Shield does not leak prompt or action payload content to Nexus-operated services. On-prem and air-gapped modes keep inspection and UAR sealing on your metal."
          />
          <SignalCard
            icon={BookOpen}
            title="Transparent threat model"
            body="CISO-ready architecture, control-plane separation, and benchmark vs production proof lanes — see the architecture whitepaper."
            href={`${REPO_DOCS}/architecture-whitepaper.md`}
            linkLabel="architecture-whitepaper.md"
          />
          <SignalCard
            icon={FileCheck}
            title="Open-source credibility"
            body="Governance runtime (MIT) and evaluation harness (Apache 2.0) are source-available for audit; container images support standard SBOM tooling (Syft, Trivy) in your registry pipeline."
            href="https://github.com/baturhantasdelen-sudo/core-ai-firewall/tree/main/harness"
            linkLabel="harness repository"
          />
          <SignalCard
            icon={FlaskConical}
            title="PoC-first sandbox"
            body="Try policy and sandbox flows without API keys: production landing playground (/api/sandbox) and local reference stack on :8090."
            href="/#playground"
            linkLabel="Open playground"
            internal
          />
        </div>
      </section>

      {!compact && (
        <section className="flex flex-wrap gap-3 border-t border-white/10 pt-8">
          <Link
            href="/proof-center"
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-zinc-900 px-4 py-2 text-sm text-zinc-200 hover:border-indigo-500/40"
          >
            <Box className="h-4 w-4 text-indigo-400" />
            Proof Center
          </Link>
          <Link
            href="/dashboard/trust-hub"
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-zinc-900 px-4 py-2 text-sm text-zinc-200 hover:border-cyan-500/40"
          >
            <ShieldCheck className="h-4 w-4 text-cyan-400" />
            Live Trust Hub
          </Link>
        </section>
      )}
    </div>
  );
}

function SignalCard({
  icon: Icon,
  title,
  body,
  href,
  linkLabel,
  internal,
}: {
  icon: typeof Lock;
  title: string;
  body: string;
  href?: string;
  linkLabel?: string;
  internal?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-zinc-900/40 p-5">
      <Icon className="h-5 w-5 text-zinc-400" />
      <h3 className="mt-3 text-sm font-semibold text-zinc-100">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-zinc-500">{body}</p>
      {href && linkLabel ? (
        internal ? (
          <Link href={href} className="mt-3 inline-block text-xs font-medium text-emerald-400 hover:underline">
            {linkLabel} →
          </Link>
        ) : (
          <a
            href={href}
            className="mt-3 inline-block text-xs font-medium text-indigo-400 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            {linkLabel} →
          </a>
        )
      ) : null}
    </div>
  );
}
