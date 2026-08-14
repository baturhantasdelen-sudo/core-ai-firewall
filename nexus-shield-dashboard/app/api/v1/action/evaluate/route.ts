import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateApiKey, extractApiKey } from '@/lib/auth/api-key';
import { evaluateAgentAction } from '@/lib/engine/action-firewall';

export const runtime = 'nodejs';

const evaluateSchema = z.object({
  agent_id: z.string().min(1),
  user_intent: z.string().min(1),
  tool_call: z.object({
    name: z.string().min(1),
    args: z.record(z.string(), z.unknown()).default({}),
  }),
  agent_capabilities: z.array(z.string()).default([]),
});

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
    const parsed = evaluateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { agent_id, user_intent, tool_call, agent_capabilities } = parsed.data;

    const result = evaluateAgentAction({
      agentId: agent_id,
      userIntent: user_intent,
      toolCall: {
        name: tool_call.name,
        args: tool_call.args,
      },
      agentCapabilities: agent_capabilities,
    });

    const statusCode =
      result.decision === 'BLOCK' ? 403 : result.decision === 'HUMAN_APPROVAL_REQUIRED' ? 202 : 200;

    return NextResponse.json(
      {
        success: result.decision !== 'BLOCK',
        decision: result.decision,
        risk_score: result.riskScore,
        intent_match_score: result.intentMatchScore,
        intent_divergence_percent: result.intentDivergencePercent,
        agent_status: result.agentStatus ?? 'ACTIVE',
        capabilities_revoked: result.capabilitiesRevoked ?? false,
        violations: result.violations,
        kill_switch_triggered: result.killSwitchTriggered,
        latency_ms: Math.round((result.latencyMs ?? 0) * 100) / 100,
      },
      { status: statusCode },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('[action/evaluate] error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: '/api/v1/action/evaluate',
    method: 'POST',
    auth: 'x-api-key or x-nexus-api-key',
    body: {
      agent_id: 'crewai-ops-agent-1',
      user_intent: 'Invoice Check for customer #4421',
      tool_call: { name: 'read_invoice', args: { customer_id: '4421' } },
      agent_capabilities: ['READ', 'API_CALL'],
    },
    responses: {
      200: 'ALLOW',
      202: 'HUMAN_APPROVAL_REQUIRED',
      403: 'BLOCK',
    },
  });
}
