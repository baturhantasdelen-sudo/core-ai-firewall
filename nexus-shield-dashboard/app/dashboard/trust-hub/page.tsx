import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { TrustHubPanel } from '@/components/dashboard/TrustHubPanel';
import { ProveTrustPanel } from '@/components/dashboard/ProveTrustPanel';
import { EvidencePanel } from '@/components/dashboard/EvidencePanel';
import { JitCredentialsPanel } from '@/components/dashboard/JitCredentialsPanel';
import { MemorySecurityPanel } from '@/components/dashboard/MemorySecurityPanel';
import { RedTeamPanel } from '@/components/dashboard/RedTeamPanel';
import { buildTrustHubSnapshot } from '@/lib/mock-trust-hub-data';
import { buildProveTrustSnapshot } from '@/lib/mock-prove-trust-data';
import { getAuthContext } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export default async function TrustHubPage() {
  const auth = await getAuthContext();
  if (!auth) {
    redirect('/login?next=/dashboard/trust-hub');
  }

  const snapshot = buildTrustHubSnapshot();
  const proveTrustSnapshot = buildProveTrustSnapshot();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-7xl space-y-8 px-6 py-10">
        <DashboardHeader apiKey={auth.org.api_key ?? 'nex_no_api_key_configured'} />

        <div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs text-zinc-500 transition hover:text-zinc-300"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Dashboard
          </Link>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-cyan-400" />
            <h1 className="text-2xl font-semibold tracking-tight">Agent Trust &amp; Prove Hub</h1>
            <span className="inline-flex items-center gap-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-cyan-200">
              Katman 3 — PROVE &amp; TRUST
            </span>
          </div>
          <p className="mt-2 max-w-3xl text-sm text-zinc-400">
            Evidential outcome verification with concrete proof bundles, dynamic real-time trust scoring
            with instant restriction tiers, and collective zero-knowledge digital immune network
            propagation across the Nexus Shield fleet.
          </p>
        </div>

        <EvidencePanel />

        <JitCredentialsPanel />

        <MemorySecurityPanel />

        <RedTeamPanel />

        <ProveTrustPanel snapshot={proveTrustSnapshot} />

        <TrustHubPanel snapshot={snapshot} />
      </div>
    </div>
  );
}
