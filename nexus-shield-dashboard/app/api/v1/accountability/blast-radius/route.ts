import { NextResponse } from 'next/server';
import { DEMO_BLAST_RADIUS, DEMO_BLAST_WHAT_IF } from '@/lib/proof-center/accountability-demo';
import { getShieldApiUrl } from '@/lib/api-config';

export async function GET() {
  try {
    const upstream = getShieldApiUrl('/v1/accountability/blast-radius');
    const res = await fetch(upstream, { next: { revalidate: 15 } });
    if (res.ok) {
      const data = await res.json();
      return NextResponse.json({ ...data, what_if: DEMO_BLAST_WHAT_IF });
    }
  } catch {
    /* fall through */
  }
  return NextResponse.json({ ...DEMO_BLAST_RADIUS, what_if: DEMO_BLAST_WHAT_IF });
}
