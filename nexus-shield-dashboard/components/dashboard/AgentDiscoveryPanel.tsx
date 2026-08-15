'use client';

import { useMemo, useState, useTransition } from 'react';
import {
  AlertTriangle,
  Bot,
  EyeOff,
  RefreshCw,
  Search,
  Server,
  ShieldAlert,
} from 'lucide-react';
import {
  buildMockDiscoveryScan,
  filterAgentInventory,
  type AgentInventory,
  type AgentInventoryStatus,
  type AgentInventoryType,
  type DiscoveryScanResult,
} from '@/lib/discovery';
import { scanMcpFleet } from '@/lib/mcp/scanner';

interface AgentDiscoveryPanelProps {
  initialScan?: DiscoveryScanResult;
}

const TYPE_OPTIONS: Array<{ value: AgentInventoryType | 'ALL'; label: string }> = [
  { value: 'ALL', label: 'All Types' },
  { value: 'LANGCHAIN', label: 'LangChain' },
  { value: 'AUTOGEN', label: 'AutoGen' },
  { value: 'MCP_SERVER', label: 'MCP Server' },
  { value: 'CUSTOM_AGENT', label: 'Custom Agent' },
  { value: 'SHADOW_AGENT', label: 'Shadow Agent' },
];

const STATUS_OPTIONS: Array<{ value: AgentInventoryStatus | 'ALL'; label: string }> = [
  { value: 'ALL', label: 'All Status' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
  { value: 'QUARANTINED', label: 'Quarantined' },
];

function typeBadgeClass(type: AgentInventoryType): string {
  switch (type) {
    case 'SHADOW_AGENT':
      return 'border-rose-500/40 bg-rose-500/15 text-rose-200';
    case 'MCP_SERVER':
      return 'border-violet-500/30 bg-violet-500/10 text-violet-200';
    case 'LANGCHAIN':
      return 'border-indigo-500/30 bg-indigo-500/10 text-indigo-200';
    case 'AUTOGEN':
      return 'border-orange-500/30 bg-orange-500/10 text-orange-200';
    default:
      return 'border-cyan-500/30 bg-cyan-500/10 text-cyan-200';
  }
}

function statusBadgeClass(status: AgentInventoryStatus): string {
  switch (status) {
    case 'QUARANTINED':
      return 'border-rose-500/40 bg-rose-500/15 text-rose-200';
    case 'INACTIVE':
      return 'border-zinc-500/30 bg-zinc-500/10 text-zinc-300';
    default:
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200';
  }
}

function riskBarClass(score: number): string {
  if (score >= 80) return 'bg-rose-500';
  if (score >= 70) return 'bg-orange-500';
  if (score >= 50) return 'bg-amber-500';
  return 'bg-emerald-500';
}

export function AgentDiscoveryPanel({ initialScan }: AgentDiscoveryPanelProps) {
  const [scan, setScan] = useState<DiscoveryScanResult>(initialScan ?? buildMockDiscoveryScan());
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<AgentInventoryType | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<AgentInventoryStatus | 'ALL'>('ALL');
  const [lastMcpScan, setLastMcpScan] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filteredAgents = useMemo(
    () =>
      filterAgentInventory(scan.agents, {
        search,
        type: typeFilter,
        status: statusFilter,
      }),
    [scan.agents, search, typeFilter, statusFilter],
  );

  function handleRescan() {
    startTransition(async () => {
      const refreshed = buildMockDiscoveryScan();
      const mcpTargets = refreshed.agents
        .filter((a) => a.type === 'MCP_SERVER')
        .map((a) => {
          const [host, portStr] = a.endpoint.split(':');
          return { host: host ?? '127.0.0.1', port: Number.parseInt(portStr ?? '3100', 10) };
        });

      const mcpResults = await scanMcpFleet(mcpTargets.slice(0, 4), { fallbackToMock: true });
      const toolCounts = new Map<string, number>();
      for (const result of mcpResults) {
        toolCounts.set(`${result.host}:${result.port}`, result.tools.length);
      }

      const enrichedAgents = refreshed.agents.map((agent) => {
        const count = toolCounts.get(agent.endpoint);
        return count !== undefined ? { ...agent, mcpToolsCount: count } : agent;
      });

      setScan({
        ...refreshed,
        agents: enrichedAgents,
        scannedAt: new Date().toISOString(),
        source: 'hybrid',
      });
      setLastMcpScan(new Date().toLocaleTimeString());
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-500">
            Agent Discovery &amp; Network Visibility
          </h2>
          <p className="mt-1 text-xs text-zinc-600">
            P0 Sprint 1-2 — eBPF/network heuristics + MCP JSON-RPC inventory mapping
          </p>
        </div>
        <button
          type="button"
          onClick={handleRescan}
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-4 py-2 text-sm font-medium text-indigo-200 transition hover:border-indigo-500/50 hover:bg-indigo-500/15 disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${isPending ? 'animate-spin' : ''}`} />
          {isPending ? 'Scanning…' : 'Rescan Network'}
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total AI Agents" value={scan.summary.totalAgents} icon={Bot} accent="text-indigo-400" />
        <StatCard
          label="Shadow / Unknown Agents"
          value={scan.summary.shadowAgents}
          icon={EyeOff}
          accent="text-rose-400"
          alert={scan.summary.shadowAgents > 0}
        />
        <StatCard label="MCP Servers" value={scan.summary.mcpServers} icon={Server} accent="text-violet-400" />
        <StatCard
          label="High Risk Agents"
          value={scan.summary.highRiskAgents}
          icon={ShieldAlert}
          accent="text-orange-400"
          alert={scan.summary.highRiskAgents > 0}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-zinc-900/50 p-4">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search agents, endpoints, types…"
            className="w-full rounded-lg border border-white/10 bg-zinc-950 py-2 pl-9 pr-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-indigo-500/40 focus:outline-none"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as AgentInventoryType | 'ALL')}
          className="rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-zinc-300 focus:border-indigo-500/40 focus:outline-none"
        >
          {TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as AgentInventoryStatus | 'ALL')}
          className="rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-zinc-300 focus:border-indigo-500/40 focus:outline-none"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/70">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-zinc-900/80 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                <th className="px-4 py-3">Agent</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Endpoint</th>
                <th className="px-4 py-3">Risk</th>
                <th className="px-4 py-3">MCP Tools</th>
                <th className="px-4 py-3">Detected</th>
              </tr>
            </thead>
            <tbody>
              {filteredAgents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-zinc-500">
                    No agents match the current filters.
                  </td>
                </tr>
              ) : (
                filteredAgents.map((agent) => (
                  <AgentRow key={agent.id} agent={agent} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-600">
        <span>
          Source: <span className="text-zinc-400">{scan.source}</span> · Scanned{' '}
          {new Date(scan.scannedAt).toLocaleString()}
        </span>
        {lastMcpScan ? (
          <span className="inline-flex items-center gap-1 text-indigo-300/80">
            <AlertTriangle className="h-3 w-3" />
            MCP tools/list + prompts/list refreshed at {lastMcpScan}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function StatCard({
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
          ? 'border-rose-500/40 bg-rose-500/10 shadow-[0_0_20px_rgba(244,63,94,0.12)]'
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

function AgentRow({ agent }: { agent: AgentInventory }) {
  return (
    <tr className="border-b border-white/5 transition hover:bg-zinc-900/40">
      <td className="px-4 py-3">
        <p className="font-medium text-zinc-100">{agent.name}</p>
        <p className="font-mono text-[10px] text-zinc-600">{agent.id}</p>
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${typeBadgeClass(agent.type)}`}>
          {agent.type.replace('_', ' ')}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusBadgeClass(agent.status)}`}>
          {agent.status}
        </span>
      </td>
      <td className="px-4 py-3">
        <code className="text-xs text-cyan-300/90">{agent.endpoint}</code>
      </td>
      <td className="px-4 py-3">
        <div className="flex min-w-[88px] items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-800">
            <div
              className={`h-full rounded-full ${riskBarClass(agent.riskScore)}`}
              style={{ width: `${agent.riskScore}%` }}
            />
          </div>
          <span className="w-7 text-right text-xs font-semibold text-zinc-300">{agent.riskScore}</span>
        </div>
      </td>
      <td className="px-4 py-3 text-zinc-300">{agent.mcpToolsCount}</td>
      <td className="px-4 py-3 text-xs text-zinc-500">
        {new Date(agent.detectedAt).toLocaleString()}
      </td>
    </tr>
  );
}
