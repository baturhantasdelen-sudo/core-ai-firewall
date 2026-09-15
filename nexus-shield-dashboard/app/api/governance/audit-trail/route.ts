import { NextResponse } from 'next/server';
import { getShieldApiUrl } from '@/lib/api-config';

export const dynamic = 'force-dynamic';

/** Server proxy for immutable governance audit trail. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = searchParams.get('limit') ?? '50';
  const upstream = getShieldApiUrl(`/api/governance/audit-trail?limit=${limit}`);

  try {
    const response = await fetch(upstream, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    const body = await response.text();
    return new NextResponse(body, {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return NextResponse.json({ error: 'Audit trail upstream unavailable' }, { status: 502 });
  }
}
