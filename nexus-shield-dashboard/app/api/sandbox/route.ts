import { NextRequest, NextResponse } from 'next/server';
import {
  VISITOR_COOKIE,
  SANDBOX_TIMEOUT_MS,
  getUsageSnapshot,
  recordSandboxUsage,
  resolveUsageContext,
  usageLimitResponse,
} from '@/lib/usage/quota';

export const runtime = 'nodejs';

const DEFAULT_API_BASE = 'https://api.nexusshield.ai';

function attachVisitorCookie(response: NextResponse, visitorId: string, shouldSet: boolean) {
  if (shouldSet) {
    response.cookies.set(VISITOR_COOKIE, visitorId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 365,
      path: '/',
    });
  }
}

export async function POST(req: NextRequest) {
  const apiBase = (process.env.NEXUS_SHIELD_API_URL ?? DEFAULT_API_BASE).replace(/\/$/, '');
  const { org, visitorId, setVisitorCookie } = await resolveUsageContext(req);

  const snapshot = await getUsageSnapshot(org, org ? null : visitorId);
  if (!snapshot.allowed) {
    const res = NextResponse.json(usageLimitResponse(snapshot), { status: 403 });
    attachVisitorCookie(res, visitorId, setVisitorCookie);
    return res;
  }

  let body: string;
  try {
    body = await req.text();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const started = performance.now();

  try {
    const upstream = await fetch(`${apiBase}/api/sandbox`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      cache: 'no-store',
      signal: AbortSignal.timeout(SANDBOX_TIMEOUT_MS),
    });

    const proxyLatencyMs = performance.now() - started;
    const responseText = await upstream.text();

    let upstreamLatency: number | undefined;
    try {
      const parsed = JSON.parse(responseText) as { latency_ms?: number };
      if (typeof parsed.latency_ms === 'number') upstreamLatency = parsed.latency_ms;
    } catch {
      // non-json upstream body
    }

    const measuredLatency = upstreamLatency ?? proxyLatencyMs;
    const shouldCount = upstream.status === 200 || upstream.status === 403;

    if (shouldCount) {
      await recordSandboxUsage({
        orgId: org?.id ?? null,
        visitorId,
        status: upstream.status === 403 ? 'blocked' : 'passed',
        latencyMs: measuredLatency,
      });
    }

    const res = new NextResponse(responseText, {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('Content-Type') ?? 'application/json',
        'X-Nexus-Latency-Ms': measuredLatency.toFixed(2),
        'X-Nexus-Proxy-Ms': proxyLatencyMs.toFixed(2),
      },
    });
    attachVisitorCookie(res, visitorId, setVisitorCookie);
    return res;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Sandbox proxy failed';
    const isTimeout = message.toLowerCase().includes('timeout') || message.includes('aborted');
    const res = NextResponse.json(
      { error: isTimeout ? 'Sandbox request timed out' : message },
      { status: isTimeout ? 504 : 502 },
    );
    attachVisitorCookie(res, visitorId, setVisitorCookie);
    return res;
  }
}
