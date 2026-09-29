import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { evaluateAgentAction } from '@/lib/engine/action-firewall';
import { toActionReceiptAPI } from '@/lib/uar/action-receipt-api';
import { buildEvidenceChainPreview } from '@/lib/uar/evidence-chain-stages';
import crypto from 'crypto';

export const runtime = 'nodejs';

const inspectSchema = z.object({
  agent_id: z.string().min(1).default('demo:agent-01'),
  user_intent: z.string().min(1),
  tool_call: z.object({
    name: z.string().min(1),
    args: z.record(z.string(), z.unknown()).default({}),
  }),
});

/** Local developer endpoint — inspect standardized Action Receipt API JSON without API key. */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = inspectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid payload', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { agent_id, user_intent, tool_call } = parsed.data;
  const result = evaluateAgentAction({
    agentId: agent_id,
    userIntent: user_intent,
    toolCall: { name: tool_call.name, args: tool_call.args },
    agentCapabilities: [],
  });

  const timestamp = new Date().toISOString();
  const receiptId = `uar_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const beforeHash = `sha256:${crypto.createHash('sha256').update(`before:${agent_id}:${tool_call.name}`).digest('hex')}`;
  const afterHash = `sha256:${crypto.createHash('sha256').update(`after:${result.decision}`).digest('hex')}`;

  const core = {
    receipt_id: receiptId,
    timestamp,
    agent: { id: agent_id, identity_verified: false },
    intent: user_intent,
    proposed_action: { tool: tool_call.name, params: tool_call.args },
    policy_evaluated: { rule_id: 'RUNTIME_ACTION_GOVERNANCE', action: result.decision },
    decision: result.decision,
    execution_state: { before_hash: beforeHash, after_hash: afterHash },
  };
  const evidenceHash = crypto
    .createHash('sha256')
    .update(JSON.stringify(core, Object.keys(core).sort()))
    .digest('hex');

  const actionReceipt = toActionReceiptAPI({
    agentId: agent_id,
    intent: user_intent,
    toolName: tool_call.name,
    toolParams: tool_call.args,
    decision: result.decision,
    receiptId,
    timestamp,
    beforeHash,
    afterHash,
    evidenceHash,
  });

  const evidence_chain = buildEvidenceChainPreview({
    intent: user_intent,
    toolName: tool_call.name,
    decision: result.decision,
    beforeHash,
    afterHash,
    evidenceHash,
  });

  return NextResponse.json({
    action_receipt: actionReceipt,
    universal_action_receipt: { ...core, evidence_bundle_hash: evidenceHash },
    evidence_chain,
    evaluation: {
      decision: result.decision,
      risk_score: result.riskScore,
      violations: result.violations,
    },
  });
}

export async function GET() {
  return NextResponse.json({
    endpoint: '/api/v1/uar/inspect',
    method: 'POST',
    description: 'Developer UAR inspect — no API key required',
    schema: 'schemas/uar_action_receipt.schema.json',
  });
}
