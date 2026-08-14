import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, Bot, Eye } from 'lucide-react';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { AgentInventoryPanel } from '@/components/dashboard/AgentInventoryPanel';
import { buildMockEnvironmentScan } from '@/lib/mock-agent-data';
import { getAuthContext } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export default async function AgentsPage() {
  const auth = await getAuthContext();
  if (!auth) {
    redirect('/login?next=/dashboard/agents');
  }

  const environmentScan = buildMockEnvironmentScan();

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
              <Bot className="h-5 w-5 text-indigo-400" />
              <h1 className="text-2xl font-semibold tracking-tight">AI Agent Inventory</h1>
              <span className="inline-flex items-center gap-1 rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-violet-200">
                <Eye className="h-3 w-3" />
                Katman 1 — SEE
              </span>
            </div>
            <p className="mt-2 max-w-2xl text-sm text-zinc-400">
              Effective Authority mapping — compare declared agent scopes against real permissions
              inferred from API keys, OAuth tokens, database connection strings, and MCP tools.
            </p>
          </div>
        </div>

        <AgentInventoryPanel scan={environmentScan} />
      </div>
    </div>
  );
}
