import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** GET /api/v1/health — versioned health for monitors and Cloudflare origin checks. */
export async function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      service: 'nexus-shield-dashboard',
      version: 'v1',
      healthy: true,
      timestamp: new Date().toISOString(),
    },
    { status: 200 },
  );
}
