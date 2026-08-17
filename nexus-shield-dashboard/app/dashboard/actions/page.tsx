import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, ShieldAlert } from 'lucide-react';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { ActionFirewallPanel } from '@/components/dashboard/ActionFirewallPanel';
import { ActionControlPanel } from '@/components/dashboard/ActionControlPanel';
import { TrajectoryFirewallPanel } from '@/components/dashboard/TrajectoryFirewallPanel';
import { IntentMcpPanel } from '@/components/dashboard/IntentMcpPanel';
import {
  getActionFirewallSummary,
  mockActionFirewallLogs,
} from '@/lib/mock-action-firewall-data';
import {
  getActionControlSummary,
  mockMcpRuntimeLogs,
  mockPendingApprovals,
  mockTrajectoryControlLogs,
} from '@/lib/mock-action-control-data';
import { getAuthContext } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export default async function ActionFirewallPage() {
  const auth = await getAuthContext();
  if (!auth) {
    redirect('/login?next=/dashboard/actions');
  }

  const summary = getActionFirewallSummary();
  const controlSummary = getActionControlSummary();

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
              <ShieldAlert className="h-5 w-5 text-rose-400" />
              <h1 className="text-2xl font-semibold tracking-tight">Action Control Center</h1>
              <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-rose-200">
                Katman 2 — CONTROL
              </span>
            </div>
            <p className="mt-2 max-w-3xl text-sm text-zinc-400">
              30-second trajectory sequence analysis, MCP runtime control across IDENTITY · PERMISSIONS
              · NETWORK · DATA, and human approval gateway for high-risk actions that require operator
              review instead of full block.
            </p>
          </div>
        </div>

        <TrajectoryFirewallPanel />

        <IntentMcpPanel />

        <ActionControlPanel
          trajectoryLogs={mockTrajectoryControlLogs}
          mcpLogs={mockMcpRuntimeLogs}
          pendingApprovals={mockPendingApprovals}
          summary={controlSummary}
        />

        <ActionFirewallPanel logs={mockActionFirewallLogs} summary={summary} />
      </div>
    </div>
  );
}
