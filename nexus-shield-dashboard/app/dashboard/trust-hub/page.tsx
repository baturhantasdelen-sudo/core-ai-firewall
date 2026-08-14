import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { TrustHubPanel } from '@/components/dashboard/TrustHubPanel';
import { buildTrustHubSnapshot } from '@/lib/mock-trust-hub-data';
import { getAuthContext } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export default async function TrustHubPage() {
  const auth = await getAuthContext();
  if (!auth) {
    redirect('/login?next=/dashboard/trust-hub');
  }

  const snapshot = buildTrustHubSnapshot();

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
            <ShieldCheck className="h-5 w-5 text-cyan-400" />
            <h1 className="text-2xl font-semibold tracking-tight">Agent Trust Hub</h1>
          </div>
          <p className="mt-2 max-w-3xl text-sm text-zinc-400">
            Unified view of tool-chain trajectories, evidence chain verification, MCP guardrails,
            memory integrity, and inter-agent reputation for advanced AI agent governance.
          </p>
        </div>

        <TrustHubPanel snapshot={snapshot} />
      </div>
    </div>
  );
}
