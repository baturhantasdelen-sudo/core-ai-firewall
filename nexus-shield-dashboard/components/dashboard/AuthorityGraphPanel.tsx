'use client';

import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  Database,
  Filter,
  Globe,
  HardDrive,
  ShieldAlert,
  ShieldOff,
  Wrench,
} from 'lucide-react';
import type { AgentInventoryRecord } from '@/lib/engine/agents/inventory';
import { getMockFileContentForAgent } from '@/lib/mock-agent-data';
import {
  calculateEffectiveAuthority,
  type AuthorityNodeType,
  type CombinatorialRiskFinding,
  type EffectiveRiskLevel,
} from '@/lib/authority';

interface AuthorityGraphPanelProps {
  agents: AgentInventoryRecord[];
  getFileContent?: (sourceFile: string) => string | undefined;
}

const NODE_ICONS: Record<AuthorityNodeType, typeof Bot> = {
  Agent: Bot,
  Tool: Wrench,
  Database: Database,
  ExternalAPI: Globe,
  DataAsset: HardDrive,
};

const NODE_TONE: Record<AuthorityNodeType, string> = {
  Agent: 'border-violet-500/40 bg-violet-500/10 text-violet-200',
  Tool: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-200',
  Database: 'border-rose-500/30 bg-rose-500/10 text-rose-200',
  ExternalAPI: 'border-orange-500/30 bg-orange-500/10 text-orange-200',
  DataAsset: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
};

function riskTone(level: EffectiveRiskLevel): string {
  switch (level) {
    case 'CRITICAL':
      return 'border-rose-500/40 bg-rose-500/15 text-rose-200';
    case 'HIGH':
      return 'border-orange-500/30 bg-orange-500/10 text-orange-200';
    case 'MEDIUM':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-200';
    default:
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200';
  }
}

function severityTone(severity: EffectiveRiskLevel): string {
  return riskTone(severity);
}

export function AuthorityGraphPanel({
  agents,
  getFileContent = getMockFileContentForAgent,
}: AuthorityGraphPanelProps) {
  const [selectedAgentId, setSelectedAgentId] = useState(agents[0]?.id ?? '');
  const [nodeTypeFilter, setNodeTypeFilter] = useState<AuthorityNodeType | 'ALL'>('ALL');
  const [minRisk, setMinRisk] = useState<'ALL' | EffectiveRiskLevel>('ALL');
  const [revokeNotice, setRevokeNotice] = useState<string | null>(null);

  const selectedAgent = agents.find((a) => a.id === selectedAgentId) ?? agents[0];

  const authority = useMemo(() => {
    if (!selectedAgent) return null;
    const fileContent = getFileContent(selectedAgent.sourceFile);
    return calculateEffectiveAuthority(selectedAgent, fileContent);
  }, [selectedAgent, getFileContent]);

  const filteredNodes = useMemo(() => {
    if (!authority) return [];
    return authority.graph.nodes.filter((node) => {
      if (nodeTypeFilter !== 'ALL' && node.type !== nodeTypeFilter) return false;
      if (minRisk === 'ALL') return true;
      const order: EffectiveRiskLevel[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
      const graphLevel = authority.graph.effectiveRiskLevel;
      return order.indexOf(graphLevel) >= order.indexOf(minRisk);
    });
  }, [authority, nodeTypeFilter, minRisk]);

  const criticalFindings =
    authority?.graph.combinatorialRisks.filter(
      (f) => f.severity === 'CRITICAL' || f.severity === 'HIGH',
    ) ?? [];

  function handleRevokeCapability(finding: CombinatorialRiskFinding) {
    const target = finding.revokeTarget ?? finding.toolsInvolved[finding.toolsInvolved.length - 1];
    setRevokeNotice(
      `[Draft] Revoke Capability queued for "${target}" on agent "${selectedAgent?.name}" — Katman 2 CONTROL API wiring pending.`,
    );
    window.setTimeout(() => setRevokeNotice(null), 4000);
  }

  if (!selectedAgent || !authority) {
    return (
      <p className="text-sm text-zinc-500">No agents available for Effective Authority Graph analysis.</p>
    );
  }

  const { graph } = authority;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-500">
            Effective Authority Graph (EAG)
          </h2>
          <p className="mt-1 text-xs text-zinc-600">
            P0 Sprint 3-4 — RBAC + Tool capability combinatorics · Agent → Tool → Resource
          </p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${riskTone(graph.effectiveRiskLevel)}`}>
          Effective Risk: {graph.effectiveRiskLevel} · {graph.effectiveRiskScore}/100
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-zinc-900/50 p-4">
        <Filter className="h-4 w-4 text-zinc-500" />
        <select
          value={selectedAgentId}
          onChange={(e) => setSelectedAgentId(e.target.value)}
          className="rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 focus:border-violet-500/40 focus:outline-none"
        >
          {agents.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.name}
            </option>
          ))}
        </select>
        <select
          value={nodeTypeFilter}
          onChange={(e) => setNodeTypeFilter(e.target.value as AuthorityNodeType | 'ALL')}
          className="rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-zinc-300 focus:outline-none"
        >
          <option value="ALL">All Node Types</option>
          <option value="Agent">Agent</option>
          <option value="Tool">Tool</option>
          <option value="Database">Database</option>
          <option value="ExternalAPI">External API</option>
          <option value="DataAsset">Data Asset</option>
        </select>
        <select
          value={minRisk}
          onChange={(e) => setMinRisk(e.target.value as 'ALL' | EffectiveRiskLevel)}
          className="rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-zinc-300 focus:outline-none"
        >
          <option value="ALL">All Risk Levels</option>
          <option value="CRITICAL">Critical+</option>
          <option value="HIGH">High+</option>
          <option value="MEDIUM">Medium+</option>
          <option value="LOW">Low+</option>
        </select>
      </div>

      {graph.privilegeEscalationDetected ? (
        <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-rose-400" />
            <div>
              <p className="text-sm font-semibold text-rose-200">Privilege Escalation Detected</p>
              <p className="mt-1 text-xs text-rose-200/80">
                Effective authority exceeds declared RBAC scopes via cross-tool capability chaining.
                Hidden permissions: {authority.hiddenPermissions.join(', ') || 'none listed'}.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {criticalFindings.length > 0 ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {criticalFindings.map((finding) => (
            <div
              key={`${finding.kind}-${finding.toolsInvolved.join('-')}`}
              className={`rounded-xl border p-4 ${severityTone(finding.severity)}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide">{finding.kind.replace(/_/g, ' ')}</p>
                    <p className="mt-1 text-sm">{finding.description}</p>
                    <p className="mt-2 font-mono text-[10px] opacity-80">
                      Path: {finding.path.join(' → ')}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRevokeCapability(finding)}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-rose-500/40 bg-rose-500/15 px-2.5 py-1.5 text-[10px] font-semibold text-rose-100 transition hover:bg-rose-500/25"
                >
                  <ShieldOff className="h-3 w-3" />
                  Revoke Capability
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {revokeNotice ? (
        <p className="rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 py-2 text-xs text-orange-200">
          {revokeNotice}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/70">
          <div className="border-b border-white/10 bg-zinc-900/80 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Authority Graph — {graph.edges.length} edges
            </p>
          </div>
          <div className="max-h-80 overflow-y-auto p-4">
            <div className="space-y-2">
              {filteredNodes.map((node) => {
                const Icon = NODE_ICONS[node.type];
                const outgoing = graph.edges.filter((e) => e.sourceId === node.id);
                return (
                  <div key={node.id} className="rounded-lg border border-white/5 bg-zinc-900/40 p-3">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-medium ${NODE_TONE[node.type]}`}>
                        <Icon className="h-3 w-3" />
                        {node.type}
                      </span>
                      <span className="font-mono text-xs text-zinc-200">{node.label}</span>
                      {node.riskWeight > 0 ? (
                        <span className="ml-auto text-[10px] text-zinc-500">w={node.riskWeight}</span>
                      ) : null}
                    </div>
                    {outgoing.length > 0 ? (
                      <p className="mt-2 pl-1 font-mono text-[10px] text-zinc-500">
                        → {outgoing.map((e) => graph.nodes.find((n) => n.id === e.targetId)?.label ?? e.targetId).join(', ')}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <ScopeCard title="Declared RBAC" scopes={authority.declaredScopes} tone="emerald" />
          <ScopeCard title="Effective Scopes" scopes={authority.effectiveScopes} tone="violet" />
          <ScopeCard
            title="Tool Capabilities"
            scopes={graph.toolCapabilities}
            tone="cyan"
          />
        </div>
      </div>

      {graph.combinatorialRisks.length > 0 ? (
        <div className="rounded-xl border border-white/10 bg-zinc-900/40 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            All Combinatorial Findings ({graph.combinatorialRisks.length})
          </p>
          <ul className="mt-3 space-y-2">
            {graph.combinatorialRisks.map((finding) => (
              <li key={`${finding.kind}-${finding.description}`} className="text-xs text-zinc-400">
                <span className={`mr-2 rounded px-1.5 py-0.5 text-[10px] font-semibold ${severityTone(finding.severity)}`}>
                  {finding.severity}
                </span>
                {finding.description}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function ScopeCard({
  title,
  scopes,
  tone,
}: {
  title: string;
  scopes: string[];
  tone: 'emerald' | 'violet' | 'cyan';
}) {
  const border =
    tone === 'emerald'
      ? 'border-emerald-500/20'
      : tone === 'violet'
        ? 'border-violet-500/20'
        : 'border-cyan-500/20';

  return (
    <div className={`rounded-xl border ${border} bg-zinc-950/50 p-4`}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{title}</p>
      <ul className="mt-2 space-y-1">
        {scopes.length === 0 ? (
          <li className="text-xs text-zinc-600">None</li>
        ) : (
          scopes.map((scope) => (
            <li key={scope} className="font-mono text-[10px] text-zinc-400">
              {scope}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
