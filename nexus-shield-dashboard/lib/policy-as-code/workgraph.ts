import type { WorkGraphDocument, WorkGraphTaskNode } from '@/lib/policy-as-code/types';

export function buildDefaultWorkGraph(agent: string): WorkGraphDocument {
  return {
    root: 'room-finance-ops',
    nodes: [
      {
        id: 'room-finance-ops',
        task_room: 'Finance Operations',
        agent,
        allowed_intents: ['READ_INVOICE', 'CREATE_PAYMENT'],
        children: ['room-finance-sub'],
      },
      {
        id: 'room-finance-sub',
        task_room: 'Delegated Sub-Agent',
        agent: `${agent}-sub`,
        allowed_intents: ['READ_INVOICE'],
        scoped_tools: ['read_invoice', 'get_invoice'],
      },
    ],
  };
}

export function resolveWorkGraphNode(
  graph: WorkGraphDocument,
  nodeId: string,
): WorkGraphTaskNode | undefined {
  return graph.nodes.find((n) => n.id === nodeId);
}

export function isIntentAllowedInWorkGraph(
  graph: WorkGraphDocument,
  nodeId: string,
  intent: string,
): boolean {
  const node = resolveWorkGraphNode(graph, nodeId);
  if (!node) return false;
  const normalized = intent.toUpperCase().replace(/\s+/g, '_');
  return node.allowed_intents.some(
    (allowed) => normalized.includes(allowed) || allowed.includes(normalized),
  );
}
