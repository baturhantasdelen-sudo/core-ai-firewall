import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** GET /api/health — local + tunnel probe target for tunnel-keepalive (dev :3000). */
export async function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      service: 'nexus-shield-dashboard',
      healthy: true,
      timestamp: new Date().toISOString(),
    },
    { status: 200 },
  );
}
