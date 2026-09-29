export type Authorization = "approved" | "blocked" | "read_only" | "approval_required";
export type PolicyResult = "passed" | "failed";
export type ExecutionResult = "success" | "failure" | "blocked" | "pending";

export interface ActionReceiptAPI {
  action_id: string;
  agent_id: string;
  intent: string;
  tool: { name: string; params: Record<string, unknown> };
  authorization: Authorization;
  policy: PolicyResult;
  execution: ExecutionResult;
  before_state_hash: string;
  after_state_hash: string;
  evidence_hash: string;
  timestamp: string;
  signature?: string;
}

function decisionToAuthorization(decision: string): Authorization {
  const map: Record<string, Authorization> = {
    ALLOW: "approved",
    BLOCK: "blocked",
    READ_ONLY: "read_only",
    REQUIRE_APPROVAL: "approval_required",
    HUMAN_APPROVAL_REQUIRED: "approval_required",
  };
  return map[decision.toUpperCase()] ?? "blocked";
}

/** Build standard receipt JSON for bridge integrations and local tests. */
export function buildActionReceipt(input: {
  agentId: string;
  intent: string;
  toolName: string;
  toolParams?: Record<string, unknown>;
  decision?: string;
  actionId?: string;
  beforeStateHash?: string;
  afterStateHash?: string;
  timestamp?: string;
}): ActionReceiptAPI {
  const decision = input.decision ?? "BLOCK";
  const authorization = decisionToAuthorization(decision);
  const policy: PolicyResult =
    authorization === "approved" || authorization === "read_only" ? "passed" : "failed";
  const execution: ExecutionResult =
    authorization === "blocked" ? "blocked" : authorization === "approved" ? "success" : "pending";

  const timestamp = input.timestamp ?? new Date().toISOString();
  const action_id = input.actionId ?? `uar_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
  const before_state_hash = input.beforeStateHash ?? `sha256:mock-before-${input.toolName}`;
  const after_state_hash = input.afterStateHash ?? `sha256:mock-after-${decision}`;

  const core = {
    action_id,
    agent_id: input.agentId,
    intent: input.intent,
    tool: { name: input.toolName, params: input.toolParams ?? {} },
    authorization,
    policy,
    execution,
    before_state_hash,
    after_state_hash,
    timestamp,
  };
  const evidence_hash = `mock-${JSON.stringify(core).length}-${decision}`;
  return { ...core, evidence_hash, signature: evidence_hash };
}

/** POST to dashboard or data-plane inspect endpoint. */
export async function inspectActionReceipt(
  baseUrl: string,
  body: {
    agent_id: string;
    user_intent: string;
    tool_call: { name: string; args?: Record<string, unknown> };
  },
): Promise<ActionReceiptAPI> {
  const url = baseUrl.replace(/\/$/, "") + "/api/v1/uar/inspect";
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`inspect failed: ${res.status}`);
  }
  return (await res.json()) as ActionReceiptAPI;
}
