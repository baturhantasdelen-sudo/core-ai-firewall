import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const apiKey = req.headers.get('x-nexus-api-key');

    if (!apiKey) {
      return NextResponse.json({ error: 'Unauthorized: Missing API Key' }, { status: 401 });
    }

    const body = (await req.json()) as {
      repository?: string;
      leakSummary?: Record<string, number>;
      totalLeaks?: number;
      timestamp?: string;
    };

    const { repository, leakSummary, totalLeaks, timestamp } = body;

    console.log(`[Nexus Shield Analytics] Logged leak for repo: ${repository}`, {
      totalLeaks,
      leakSummary,
      timestamp,
    });

    return NextResponse.json({
      success: true,
      message: 'Telemetry metrics recorded successfully',
    });
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
