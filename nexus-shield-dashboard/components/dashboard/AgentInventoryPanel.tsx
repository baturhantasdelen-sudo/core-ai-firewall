'use client';

import { Bot, Cpu, Globe, Network, Server, ShieldAlert, ShieldX, Wrench } from 'lucide-react';
import type { AgentRiskLevel } from '@/lib/engine/discovery';
import { EffectiveAuthorityGraphPanel } from '@/components/dashboard/EffectiveAuthorityGraphPanel';
import { getMockFileContentForAgent } from '@/lib/mock-agent-data';
import {
  enrichAgentInventory,
  formatDeclaredSummary,
  formatEffectiveSummary,
  type AgentInventoryRecord,
  type EnvironmentScanResult,
} from '@/lib/engine/agents/inventory';

function riskBadgeClass(level: AgentRiskLevel): string {
  switch (level) {
    case 'CRITICAL':
      return 'border-rose-500/40 bg-rose-500/15 text-rose-300';
    case 'HIGH':
      return 'border-orange-500/30 bg-orange-500/10 text-orange-300';
    case 'MEDIUM':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-300';
    default:
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
  }
}

function verifiedBadgeClass(status: AgentInventoryRecord['nhi']['verifiedStatus']): string {
  switch (status) {
    case 'ROGUE':
      return 'border-rose-500/50 bg-rose-500/20 text-rose-200';
    case 'UNVERIFIED':
      return 'border-amber-500/40 bg-amber-500/15 text-amber-200';
    default:
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200';
  }
}

interface AgentInventoryPanelProps {
  scan: EnvironmentScanResult;
  compact?: boolean;
}

function normalizeScan(scan: EnvironmentScanResult | { agents: AgentInventoryRecord[]; overview?: EnvironmentScanResult['overview'] }): EnvironmentScanResult {
  if ('scannedAt' in scan && scan.overview) {
    const first = scan.agents[0];
    if (first && 'authorityReport' in first) {
      return scan as EnvironmentScanResult;
    }
  }

  const agents = enrichAgentInventory(
    scan.agents.map(({ id, name, framework, mcpConnections, capabilities, riskLevel, sourceFile, line }) => ({
      id,
      name,
      framework,
      mcpConnections,
      capabilities,
      riskLevel,
      sourceFile,
      line,
    })),
  );

  const mcpServerNames = new Set<string>();
  let connectedTools = 0;
  for (const agent of agents) {
    connectedTools += agent.connectivity.connectedToolsCount;
    for (const connection of agent.mcpConnections) {
      mcpServerNames.add(connection.serverName);
    }
  }

  return {
    overview: scan.overview ?? {
      totalAiAgents: agents.length,
      connectedTools,
      mcpServers: mcpServerNames.size,
      unknownRogueAgents: agents.filter((a) => a.nhi.verifiedStatus !== 'VERIFIED').length,
    },
    agents,
    scannedAt: new Date().toISOString(),
  };
}

export function AgentInventoryPanel({ scan, compact = false }: AgentInventoryPanelProps) {
  const environmentScan = normalizeScan(scan);

  return (
    <div className="space-y-6">
      {!compact ? (
        <>
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-500">
              AI Environment Overview
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <OverviewCard
                label="Total AI Agents"
                value={environmentScan.overview.totalAiAgents}
                icon={Bot}
                accent="text-indigo-400"
              />
              <OverviewCard
                label="Connected Tools"
                value={environmentScan.overview.connectedTools}
                icon={Wrench}
                accent="text-cyan-400"
              />
              <OverviewCard
                label="MCP Servers"
                value={environmentScan.overview.mcpServers}
                icon={Server}
                accent="text-violet-400"
              />
              <OverviewCard
                label="Unknown / Rogue Agents"
                value={environmentScan.overview.unknownRogueAgents}
                icon={ShieldX}
                accent="text-rose-400"
                alert
              />
            </div>
          </div>
        </>
      ) : null}

      {environmentScan.agents.length === 0 ? (
        <p className="text-sm text-zinc-500">No AI agents or MCP assets discovered in this scan.</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {environmentScan.agents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} compact={compact} />
          ))}
        </div>
      )}
    </div>
  );
}

function OverviewCard({
  label,
  value,
  icon: Icon,
  accent,
  alert = false,
}: {
  label: string;
  value: number;
  icon: typeof Bot;
  accent: string;
  alert?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-5 ${
        alert
          ? 'border-rose-500/40 bg-rose-500/10 shadow-[0_0_20px_rgba(244,63,94,0.15)]'
          : 'border-white/10 bg-zinc-900/60'
      }`}
    >
      <div className="flex items-center justify-between">
        <p className={`text-sm ${alert ? 'text-rose-300' : 'text-zinc-400'}`}>{label}</p>
        <Icon className={`h-4 w-4 ${accent}`} />
      </div>
      <p className={`mt-2 text-3xl font-semibold ${alert ? 'text-rose-200' : 'text-zinc-100'}`}>{value}</p>
    </div>
  );
}

function AgentCard({ agent, compact }: { agent: AgentInventoryRecord; compact?: boolean }) {
  const { authorityReport, effectiveAuthority, nhi, connectivity } = agent;
  const declaredLabel = formatDeclaredSummary(authorityReport);
  const effectiveLabel = formatEffectiveSummary(authorityReport);
  const escalation = authorityReport.privilegeEscalationDetected;

  return (
    <article className="rounded-2xl border border-white/10 bg-zinc-950/70 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-indigo-400" />
            <h3 className="font-semibold text-zinc-100">{agent.name}</h3>
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            {agent.framework} · {nhi.ownerDepartment} ·{' '}
            <code className="font-mono">{agent.sourceFile}</code>
            {agent.line ? `:${agent.line}` : ''}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${verifiedBadgeClass(nhi.verifiedStatus)}`}>
            {nhi.verifiedStatus}
          </span>
          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${riskBadgeClass(effectiveAuthority.overallRisk)}`}>
            Risk {authorityReport.riskScore}
          </span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <ConnectivityStat label="Tools" value={connectivity.connectedToolsCount} icon={Wrench} />
        <ConnectivityStat label="MCP" value={connectivity.mcpServersCount} icon={Network} />
        <ConnectivityStat label="APIs" value={connectivity.externalApisCount} icon={Globe} />
      </div>

      <div className="mt-4 rounded-xl border border-white/10 bg-zinc-900/50 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Effective Authority</p>
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-zinc-500">Declared:</span>
            <span className="rounded-md border border-white/10 bg-zinc-950 px-2 py-1 text-zinc-300">
              {declaredLabel}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-zinc-500">Effective:</span>
            <span
              className={`rounded-md border px-2 py-1 font-semibold ${
                escalation
                  ? 'border-rose-500/40 bg-rose-500/15 text-rose-200'
                  : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
              }`}
            >
              {effectiveLabel.toUpperCase()}
              {escalation ? ' (Privilege Escalation Detected)' : ''}
            </span>
          </div>
        </div>

        {authorityReport.hiddenPermissions.length > 0 ? (
          <p className="mt-2 text-[11px] text-amber-300/90">
            Hidden permissions: {authorityReport.hiddenPermissions.join(', ')}
          </p>
        ) : null}

        {escalation ? (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2">
            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400" />
            <p className="text-[11px] text-rose-200">
              Effective authority exceeds declared scopes — review credential bindings immediately.
            </p>
          </div>
        ) : null}

        <button
          type="button"
          disabled={authorityReport.hiddenPermissions.length === 0}
          onClick={() => {
            /* Revoke Unused Scopes — API wiring in Katman 2 CONTROL */
          }}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 py-1.5 text-[11px] font-medium text-orange-200 transition hover:border-orange-500/50 hover:bg-orange-500/15 disabled:cursor-not-allowed disabled:opacity-40"
          title={
            authorityReport.hiddenPermissions.length > 0
              ? `Revoke: ${authorityReport.hiddenPermissions.join(', ')}`
              : 'No unused scopes detected'
          }
        >
          Revoke Unused Scopes
        </button>
      </div>

      {!compact && agent.mcpConnections.length > 0 ? (
        <div className="mt-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">MCP Connections</p>
          <ul className="mt-2 space-y-2">
            {agent.mcpConnections.map((connection) => (
              <li
                key={`${agent.id}-${connection.serverName}`}
                className="rounded-lg border border-indigo-500/20 bg-indigo-500/5 px-3 py-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-indigo-200">{connection.serverName}</span>
                  <span className="text-[10px] uppercase tracking-wide text-indigo-300/80">
                    {connection.transport ?? 'stdio'}
                  </span>
                </div>
                <p className="mt-1 text-xs text-zinc-400">
                  Tools: {connection.tools.length > 0 ? connection.tools.join(', ') : 'none detected'}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {!compact ? (
        <EffectiveAuthorityGraphPanel
          agent={agent}
          fileContent={getMockFileContentForAgent(agent.sourceFile)}
        />
      ) : null}
    </article>
  );
}

function ConnectivityStat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof Bot;
}) {
  return (
    <div className="rounded-lg border border-white/5 bg-zinc-900/40 px-2 py-2">
      <Icon className="mx-auto h-3.5 w-3.5 text-zinc-500" />
      <p className="mt-1 text-sm font-semibold text-zinc-200">{value}</p>
      <p className="text-[10px] text-zinc-500">{label}</p>
    </div>
  );
}

/** @deprecated Use scan prop — backward compat wrapper */
export function AgentInventoryPanelLegacy({
  discovery,
  compact = false,
}: {
  discovery: EnvironmentScanResult;
  compact?: boolean;
}) {
  return <AgentInventoryPanel scan={discovery} compact={compact} />;
}
