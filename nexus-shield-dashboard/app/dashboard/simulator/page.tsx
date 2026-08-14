import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, Crosshair } from 'lucide-react';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { RedTeamSimulatorPanel } from '@/components/dashboard/RedTeamSimulatorPanel';
import { buildMockAgentDiscovery } from '@/lib/mock-agent-data';
import { getAuthContext } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export default async function SimulatorPage() {
  const auth = await getAuthContext();
  if (!auth) {
    redirect('/login?next=/dashboard/simulator');
  }

  const discovery = buildMockAgentDiscovery();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-7xl space-y-8 px-6 py-10">
        <DashboardHeader apiKey={auth.org.api_key ?? 'nex_no_api_key_configured'} />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 text-xs text-zinc-500 transition hover:text-zinc-300"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Dashboard
            </Link>
            <div className="mt-3 flex items-center gap-2">
              <Crosshair className="h-5 w-5 text-rose-400" />
              <h1 className="text-2xl font-semibold tracking-tight">AI Red Teaming Simulator</h1>
            </div>
            <p className="mt-2 max-w-3xl text-sm text-zinc-400">
              Run synthetic attack simulations against discovered agents — probing prompt injection,
              goal hijacking, privilege escalation, data exfiltration, and system prompt leakage
              through the Action Firewall runtime shield.
            </p>
          </div>
        </div>

        <RedTeamSimulatorPanel
          agents={discovery.agents}
          apiKey={auth.org.api_key ?? 'nex_no_api_key_configured'}
        />
      </div>
    </div>
  );
}
