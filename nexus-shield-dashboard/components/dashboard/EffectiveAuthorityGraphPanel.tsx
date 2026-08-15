'use client';

import { useMemo, useState } from 'react';
import { GitBranch, KeyRound, ShieldAlert, ShieldCheck } from 'lucide-react';
import type { AgentInventoryRecord } from '@/lib/engine/agents/inventory';
import {
  buildEffectiveAuthorityGraph,
  type EffectiveAuthorityGraphResult,
  type GraphNodeType,
} from '@/lib/engine/agents/discovery-graph';
import {
  issueTemporaryCapabilityToken,
  revokeAllStaticCredentials,
  validateCapabilityToken,
} from '@/lib/engine/auth/jit-credentials';

interface EffectiveAuthorityGraphPanelProps {
  agent: AgentInventoryRecord;
  fileContent?: string;
}

const NODE_TONE: Record<GraphNodeType, string> = {
  agent: 'border-violet-500/40 bg-violet-500/10 text-violet-200',
  tool: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-200',
  external_api: 'border-orange-500/30 bg-orange-500/10 text-orange-200',
  database: 'border-rose-500/30 bg-rose-500/10 text-rose-200',
  user_scope: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
};

function riskTone(level: EffectiveAuthorityGraphResult['effectiveRiskLevel']): string {
  switch (level) {
    case 'CRITICAL':
      return 'text-rose-300 border-rose-500/40 bg-rose-500/15';
    case 'HIGH':
      return 'text-orange-300 border-orange-500/30 bg-orange-500/10';
    case 'MEDIUM':
      return 'text-amber-300 border-amber-500/30 bg-amber-500/10';
    default:
      return 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10';
  }
}

export function EffectiveAuthorityGraphPanel({ agent, fileContent }: EffectiveAuthorityGraphPanelProps) {
  const graph = useMemo(
    () =>
      buildEffectiveAuthorityGraph(
        agent,
        fileContent,
        agent.authorityReport,
      ),
    [agent, fileContent],
  );

  const [jitToken, setJitToken] = useState<string | null>(null);
  const [jitStatus, setJitStatus] = useState<string | null>(null);
  const [revokeStatus, setRevokeStatus] = useState<string | null>(null);

  const elevatedIndirect = graph.indirectCapabilities.filter((entry) => entry.elevated);

  function handleIssueJit() {
    const scope = agent.capabilities[0] ?? 'READ';
    const issued = issueTemporaryCapabilityToken(agent.id, scope, 60);
    const validation = validateCapabilityToken(issued.token);
    setJitToken(issued.token);
    setJitStatus(
      validation.valid
        ? `JIT token issued (${issued.scope}) — expires ${new Date(issued.expiresAt).toLocaleTimeString()}`
        : validation.reason ?? 'Token validation failed',
    );
  }

  function handleRevokeStatic() {
    const result = revokeAllStaticCredentials(agent.id);
    setRevokeStatus(result.message);
  }

  return (
    <div className="mt-4 space-y-4 rounded-xl border border-white/10 bg-zinc-900/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-violet-400" />
          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            Effective Authority Graph
          </p>
        </div>
        <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${riskTone(graph.effectiveRiskLevel)}`}>
          {graph.effectiveRiskLevel} · {graph.effectiveRiskScore}/100
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-white/5 bg-zinc-950/60 p-3">
        <div className="flex min-w-max flex-col gap-2">
          {graph.nodes.map((node) => (
            <div key={node.id} className="flex items-center gap-2">
              <span className={`rounded-md border px-2 py-1 text-[10px] font-medium ${NODE_TONE[node.type]}`}>
                {node.type.replace('_', ' ')}
              </span>
              <span className="font-mono text-xs text-zinc-300">{node.label}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[10px] text-zinc-600">
          Chain: Agent → Tools → External APIs → Databases → User Scope ({graph.edges.length} edges)
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <MatrixCard
          title="Direct Permissions"
          icon={ShieldCheck}
          items={graph.directPermissions.map((entry) => `${entry.capability} (${entry.source})`)}
          tone="emerald"
        />
        <MatrixCard
          title="Indirect Dangerous Capabilities"
          icon={ShieldAlert}
          items={
            graph.indirectCapabilities.length > 0
              ? graph.indirectCapabilities.map(
                  (entry) =>
                    `${entry.capability} via ${entry.via}${entry.elevated ? ' ⚠ escalated' : ''}`,
                )
              : ['None detected']
          }
          tone={elevatedIndirect.length > 0 ? 'rose' : 'zinc'}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleIssueJit}
          className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-[11px] font-medium text-cyan-200 transition hover:border-cyan-500/50 hover:bg-cyan-500/15"
        >
          <KeyRound className="h-3.5 w-3.5" />
          Issue Temporary JIT Token
        </button>
        <button
          type="button"
          onClick={handleRevokeStatic}
          className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-[11px] font-medium text-rose-200 transition hover:border-rose-500/50 hover:bg-rose-500/15"
        >
          <ShieldAlert className="h-3.5 w-3.5" />
          Revoke All Static Credentials
        </button>
      </div>

      {jitToken ? (
        <p className="break-all rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-3 py-2 font-mono text-[10px] text-cyan-200">
          {jitStatus}
          <br />
          {jitToken}
        </p>
      ) : null}

      {revokeStatus ? (
        <p className="rounded-lg border border-rose-500/20 bg-rose-500/5 px-3 py-2 text-[11px] text-rose-200">
          {revokeStatus}
        </p>
      ) : null}
    </div>
  );
}

function MatrixCard({
  title,
  icon: Icon,
  items,
  tone,
}: {
  title: string;
  icon: typeof ShieldCheck;
  items: string[];
  tone: 'emerald' | 'rose' | 'zinc';
}) {
  const border =
    tone === 'emerald'
      ? 'border-emerald-500/20'
      : tone === 'rose'
        ? 'border-rose-500/20'
        : 'border-white/10';

  return (
    <div className={`rounded-lg border ${border} bg-zinc-950/50 p-3`}>
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
        <Icon className="h-3.5 w-3.5" />
        {title}
      </div>
      <ul className="mt-2 space-y-1">
        {items.map((item) => (
          <li key={item} className="font-mono text-[10px] text-zinc-400">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
