'use client';

import { Bot, Cpu, Network, ShieldAlert } from 'lucide-react';
import type { AgentAsset, AgentDiscoveryResult, AgentRiskLevel } from '@/lib/engine/discovery';

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

interface AgentInventoryPanelProps {
  discovery: AgentDiscoveryResult;
  compact?: boolean;
}

export function AgentInventoryPanel({ discovery, compact = false }: AgentInventoryPanelProps) {
  return (
    <div className="space-y-6">
      {!compact ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <MetricCard label="Total Agents" value={discovery.total_agents} icon={Bot} />
          <MetricCard label="MCP Tools" value={discovery.total_mcp_tools} icon={Network} />
          <MetricCard label="Critical Agents" value={discovery.critical_agents} icon={ShieldAlert} />
        </div>
      ) : null}

      {discovery.agents.length === 0 ? (
        <p className="text-sm text-zinc-500">No AI agents or MCP assets discovered in this scan.</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {discovery.agents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} compact={compact} />
          ))}
        </div>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof Bot;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-400">{label}</p>
        <Icon className="h-4 w-4 text-indigo-400" />
      </div>
      <p className="mt-2 text-3xl font-semibold text-zinc-100">{value}</p>
    </div>
  );
}

function AgentCard({ agent, compact }: { agent: AgentAsset; compact?: boolean }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-zinc-950/70 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-indigo-400" />
            <h3 className="font-semibold text-zinc-100">{agent.name}</h3>
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            {agent.framework} · <code className="font-mono">{agent.sourceFile}</code>
            {agent.line ? `:${agent.line}` : ''}
          </p>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${riskBadgeClass(agent.riskLevel)}`}>
          {agent.riskLevel}
        </span>
      </div>

      <div className="mt-4">
        <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Capabilities</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {agent.capabilities.map((capability) => (
            <span
              key={`${agent.id}-${capability}`}
              className="rounded-md border border-white/10 bg-zinc-900 px-2 py-1 text-[11px] font-medium text-zinc-300"
            >
              {capability}
            </span>
          ))}
        </div>
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
    </article>
  );
}
