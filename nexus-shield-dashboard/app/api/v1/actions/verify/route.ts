import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateApiKey, extractApiKey } from '@/lib/auth/api-key';
import { evaluateAgentAction } from '@/lib/engine/action-firewall';
import { createApprovalRequest } from '@/lib/engine/action-firewall/human-approval';
import { evaluateAdaptivePolicy } from '@/lib/engine/agent-policy-engine';
import {
  classifyOwaspThreat,
  inferThreatCategory,
  RUNTIME_PRIVACY_METADATA,
} from '@/lib/owasp/threat-mapping';
import { NEXUS_RUNTIME_LATENCY_METRIC } from '@/lib/brand/copy-standards';

export const runtime = 'nodejs';

const verifySchema = z.object({
  agent_id: z.string().min(1),
  user_intent: z.string().min(1),
  tool_call: z.object({
    name: z.string().min(1),
    args: z.record(z.string(), z.unknown()).default({}),
  }),
  agent_capabilities: z.array(z.string()).default([]),
  identity_verified: z.boolean().optional(),
});

/** POST /api/v1/actions/verify — cryptographic verification + Universal Action Receipt. */
export async function POST(req: NextRequest) {
  try {
    const apiKey = extractApiKey(req);
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Unauthorized: Missing x-api-key or x-nexus-api-key header' },
        { status: 401 },
      );
    }

    const org = await authenticateApiKey(apiKey);
    if (!org) {
      return NextResponse.json({ error: 'Unauthorized: Invalid API key' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = verifySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { agent_id, user_intent, tool_call, agent_capabilities, identity_verified } = parsed.data;

    const firewall = evaluateAgentAction({
      agentId: agent_id,
      userIntent: user_intent,
      toolCall: { name: tool_call.name, args: tool_call.args },
      agentCapabilities: agent_capabilities,
    });

    const policy = evaluateAdaptivePolicy(
      {
        agentId: agent_id,
        userIntent: user_intent,
        toolName: tool_call.name,
        toolArgs: tool_call.args,
        identityVerified: identity_verified ?? true,
      },
      firewall,
    );

    let approval_request_id: string | undefined;
    if (policy.decision === 'REQUIRE_APPROVAL') {
      const approval = createApprovalRequest(agent_id, {
        toolName: tool_call.name,
        userIntent: user_intent,
        riskScore: policy.risk_score,
        violations: policy.violations,
        args: tool_call.args,
      });
      approval_request_id = approval.id;
    }

    const permitted = policy.decision === 'ALLOW' || policy.decision === 'READ_ONLY';
    const statusCode =
      policy.decision === 'BLOCK' ? 403 : policy.decision === 'REQUIRE_APPROVAL' ? 202 : 200;

    const threatCategory = inferThreatCategory(policy.violations, tool_call.name);

    return NextResponse.json(
      {
        verification: {
          permitted,
          decision: policy.decision,
          rule_id: policy.rule_id,
          runtime_latency_benchmark: NEXUS_RUNTIME_LATENCY_METRIC,
        },
        receipt: policy.receipt,
        evidence_bundle_hash: policy.receipt.evidence_bundle_hash,
        approval_request_id,
        owasp_classification: classifyOwaspThreat(threatCategory, policy.violations),
        runtime_privacy: RUNTIME_PRIVACY_METADATA,
        latency_ms: Math.round((firewall.latencyMs ?? 0) * 100) / 100,
      },
      { status: statusCode },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('[actions/verify] error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: '/api/v1/actions/verify',
    method: 'POST',
    auth: 'x-api-key or x-nexus-api-key',
    body: {
      agent_id: 'financebot-prod-7f2a',
      user_intent: 'Check August Invoice #8291',
      tool_call: { name: 'read_invoice', args: { invoice_id: '8291' } },
      agent_capabilities: ['READ', 'API_CALL'],
      identity_verified: true,
    },
    decisions: ['ALLOW', 'BLOCK', 'READ_ONLY', 'REQUIRE_APPROVAL'],
  });
}
