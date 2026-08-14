import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateApiKey, extractApiKey } from '@/lib/auth/api-key';
import {
  getAgentReputation,
  listAgentReputations,
  verifyInterAgentTrust,
} from '@/lib/engine/reputation';

export const runtime = 'nodejs';

const trustSchema = z.object({
  source_agent_id: z.string().min(1),
  target_agent_id: z.string().min(1),
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
    const parsed = trustSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { source_agent_id, target_agent_id } = parsed.data;
    const trust = verifyInterAgentTrust(source_agent_id, target_agent_id);
    const targetRecord = getAgentReputation(target_agent_id);

    if (!targetRecord) {
      return NextResponse.json(
        { error: `Target agent not found in reputation registry: ${target_agent_id}` },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      trust,
      target: targetRecord,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('[agent/trust] error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
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

    const reputations = listAgentReputations();

    return NextResponse.json({
      success: true,
      total_agents: reputations.length,
      reputations,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
