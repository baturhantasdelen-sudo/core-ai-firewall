/** Policy-as-Code + WorkGraph structural contracts. */

export interface ApprovalThresholdRule {
  intent: string;
  amountGreaterThan?: number;
  raw?: string;
}

export interface EnterpriseAgentPolicy {
  agent: string;
  allowed_intents: string[];
  requires_approval: ApprovalThresholdRule[];
  blocked_actions: string[];
  workgraph?: WorkGraphDocument;
}

export interface WorkGraphTaskNode {
  id: string;
  task_room: string;
  agent: string;
  allowed_intents: string[];
  scoped_tools?: string[];
  children?: string[];
}

export interface WorkGraphDocument {
  root: string;
  nodes: WorkGraphTaskNode[];
}
