import { NextRequest, NextResponse } from 'next/server';
import { getUsageSnapshot, resolveUsageContext, VISITOR_COOKIE } from '@/lib/usage/quota';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const { org, visitorId, setVisitorCookie } = await resolveUsageContext(req);
  const snapshot = await getUsageSnapshot(org, org ? null : visitorId);

  const res = NextResponse.json({
    used: snapshot.used,
    limit: snapshot.limit,
    remaining: snapshot.remaining,
    plan: snapshot.plan,
    authenticated: Boolean(org),
  });

  if (setVisitorCookie) {
    res.cookies.set(VISITOR_COOKIE, visitorId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 365,
      path: '/',
    });
  }

  return res;
}
