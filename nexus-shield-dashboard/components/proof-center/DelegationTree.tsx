'use client';

import { AlertTriangle, GitBranch, User } from 'lucide-react';
import type { DelegationTreeView } from '@/types/aar-receipt';

export interface DelegationTreeProps {
  tree: DelegationTreeView;
}

export function DelegationTree({ tree }: DelegationTreeProps) {
  const byParent = new Map<string | undefined, typeof tree.nodes>();
  for (const node of tree.nodes) {
    const key = node.parent;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(node);
  }

  function renderBranch(parentId: string | undefined, depth: number) {
    const children = byParent.get(parentId) ?? [];
    return children.map((node) => (
      <div key={node.agent_id} className="relative ml-4 border-l border-white/10 pl-4">
        <div
          className={`mt-3 rounded-xl border p-3 ${
            node.blocked
              ? 'border-rose-500/40 bg-rose-500/10'
              : 'border-white/10 bg-zinc-900/70'
          }`}
          style={{ marginLeft: depth * 4 }}
        >
          <div className="flex flex-wrap items-center gap-2">
            {node.role === 'human' ? (
              <User className="h-4 w-4 text-cyan-400" />
            ) : (
              <GitBranch className="h-4 w-4 text-violet-400" />
            )}
            <span className="font-mono text-sm text-zinc-100">{node.agent_id}</span>
            <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase text-zinc-500">
              {node.role}
            </span>
            {node.blocked ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/40 bg-rose-500/15 px-2 py-0.5 text-[10px] font-semibold text-rose-200">
                <AlertTriangle className="h-3 w-3" />
                Blocked escalation
              </span>
            ) : null}
          </div>
          <p className="mt-2 text-xs text-zinc-400">
            Scopes: {node.allowed_scopes.join(', ')} · limit ${node.financial_limit.toLocaleString()}
          </p>
          {node.audit_message ? (
            <p className="mt-2 font-mono text-[11px] text-rose-300">{node.audit_message}</p>
          ) : null}
        </div>
        {renderBranch(node.agent_id, depth + 1)}
      </div>
    ));
  }

  return (
    <div className="rounded-2xl border border-indigo-500/20 bg-zinc-950/80 p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <GitBranch className="h-5 w-5 text-indigo-400" />
        <h3 className="text-lg font-semibold text-zinc-50">Delegation Hierarchy</h3>
      </div>
      <p className="mt-2 text-sm text-zinc-400">
        Human → agents → API tools. Violations and privilege escalation blocks appear in the audit trail.
      </p>

      <div className="mt-5">{renderBranch(undefined, 0)}</div>

      {tree.audit.length > 0 ? (
        <div className="mt-6 rounded-xl border border-rose-500/20 bg-rose-950/20 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-rose-300/80">Audit trail</p>
          <ul className="mt-2 space-y-2">
            {tree.audit.map((entry, index) => (
              <li key={index} className="font-mono text-[11px] text-rose-200/90">
                {JSON.stringify(entry)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
