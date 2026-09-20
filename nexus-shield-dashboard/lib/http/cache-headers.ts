import { NextResponse } from 'next/server';

/** Cloudflare edge micro-cache: 60s TTL + 30s stale-while-revalidate. */
export function applyEdgeMicroCache(response: NextResponse): NextResponse {
  response.headers.set(
    'Cache-Control',
    'public, s-maxage=60, stale-while-revalidate=30',
  );
  response.headers.set('Vary', 'Accept-Encoding');
  return response;
}

/** Mutating API responses must never be cached at edge or browser. */
export function applyNoStore(response: NextResponse): NextResponse {
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
