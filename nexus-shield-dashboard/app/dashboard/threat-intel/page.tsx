import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, Radar } from 'lucide-react';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { ThreatIntelPanel } from '@/components/dashboard/ThreatIntelPanel';
import { getImmuneNetworkStats, listThreatSignatures } from '@/lib/engine/immune';
import { getAuthContext } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export default async function ThreatIntelPage() {
  const auth = await getAuthContext();
  if (!auth) {
    redirect('/login?next=/dashboard/threat-intel');
  }

  const signatures = listThreatSignatures();
  const stats = getImmuneNetworkStats();

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
          <div className="mt-3 flex items-center gap-2">
            <Radar className="h-5 w-5 text-indigo-400" />
            <h1 className="text-2xl font-semibold tracking-tight">
              Threat Intelligence & Immune Network
            </h1>
          </div>
          <p className="mt-2 max-w-3xl text-sm text-zinc-400">
            Collective behavioral signatures shared across the Nexus Shield network — anonymized,
            privacy-preserving patterns that block repeat goal hijacks and privilege escalation
            attacks.
          </p>
        </div>

        <ThreatIntelPanel signatures={signatures} stats={stats} />
      </div>
    </div>
  );
}
