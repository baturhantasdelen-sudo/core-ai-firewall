import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateApiKey, extractApiKey } from '@/lib/auth/api-key';
import { findAgentForSimulation, runRedTeamSimulation } from '@/lib/engine/simulator';
import { buildMockAgentDiscovery } from '@/lib/mock-agent-data';

export const runtime = 'nodejs';

const simulateSchema = z.object({
  agent_id: z.string().min(1),
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
    const parsed = simulateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const discovery = buildMockAgentDiscovery();
    const agent = findAgentForSimulation(parsed.data.agent_id, discovery.agents);

    if (!agent) {
      return NextResponse.json(
        { error: `Agent not found in discovery inventory: ${parsed.data.agent_id}` },
        { status: 404 },
      );
    }

    const report = runRedTeamSimulation(agent);

    return NextResponse.json({
      success: true,
      agent: {
        id: agent.id,
        name: agent.name,
        framework: agent.framework,
        riskLevel: agent.riskLevel,
        capabilities: agent.capabilities,
      },
      report,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('[simulate] error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  const discovery = buildMockAgentDiscovery();

  return NextResponse.json({
    endpoint: '/api/v1/simulate',
    method: 'POST',
    auth: 'x-api-key or x-nexus-api-key',
    body: { agent_id: 'crewai-ops-agent-1' },
    available_agents: discovery.agents.map((agent) => ({
      id: agent.id,
      name: agent.name,
      framework: agent.framework,
      riskLevel: agent.riskLevel,
    })),
  });
}
