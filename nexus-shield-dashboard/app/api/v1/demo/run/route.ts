import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiKey, extractApiKey } from '@/lib/auth/api-key';
import { runPitchScenario } from '@/lib/engine/demo/pitch-scenario';

export const runtime = 'nodejs';

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

    const scenario = runPitchScenario();

    return NextResponse.json({
      success: true,
      scenario,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('[demo/run] error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: '/api/v1/demo/run',
    method: 'POST',
    auth: 'x-api-key or x-nexus-api-key',
    description: 'Investor-ready E2E pitch scenario — invoice intent vs export/upload attack chain',
  });
}
