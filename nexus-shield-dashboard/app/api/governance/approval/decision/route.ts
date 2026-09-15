import { NextResponse } from 'next/server';
import { getShieldApiUrl } from '@/lib/api-config';

export const dynamic = 'force-dynamic';

/** Proxy HITL approval decisions to upstream Fast API. */
export async function POST(request: Request) {
  const upstream = getShieldApiUrl('/v1/agent/approval/decision');
  const body = await request.text();

  try {
    const response = await fetch(upstream, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body,
    });
    const text = await response.text();
    return new NextResponse(text, {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return NextResponse.json({ message: 'Approval decision upstream unavailable' }, { status: 502 });
  }
}
