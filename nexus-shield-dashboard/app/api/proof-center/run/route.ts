import { NextResponse } from 'next/server';
import { getShieldApiUrl } from '@/lib/api-config';

export const dynamic = 'force-dynamic';

/** Trigger live Proof Center benchmark on upstream Fast API. */
export async function POST() {
  const upstream = getShieldApiUrl('/api/proof-center/run');

  try {
    const response = await fetch(upstream, {
      method: 'POST',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    const body = await response.text();
    return new NextResponse(body, {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return NextResponse.json(
      { status: 'error', message: 'Proof Center benchmark upstream unavailable' },
      { status: 502 },
    );
  }
}
