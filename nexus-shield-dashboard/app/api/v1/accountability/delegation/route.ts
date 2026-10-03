import { NextResponse } from 'next/server';
import { DEMO_DELEGATION } from '@/lib/proof-center/accountability-demo';
import { getShieldApiUrl } from '@/lib/api-config';

export async function GET() {
  try {
    const upstream = getShieldApiUrl('/v1/accountability/delegation');
    const res = await fetch(upstream, { next: { revalidate: 15 } });
    if (res.ok) {
      return NextResponse.json(await res.json());
    }
  } catch {
    /* fall through */
  }
  return NextResponse.json(DEMO_DELEGATION);
}
