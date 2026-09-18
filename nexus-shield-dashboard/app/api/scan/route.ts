import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { runAgentSecurityScan } from '@/lib/scanner';
import {
  VISITOR_COOKIE,
  getUsageSnapshot,
  recordSandboxUsage,
  resolveUsageContext,
  usageLimitResponse,
} from '@/lib/usage/quota';
export const runtime = 'nodejs';

const scanRequestSchema = z.object({
  inputType: z.enum(['endpoint', 'mcp', 'github']),
  target: z.string().min(3).max(8000),
  mcpConfig: z.string().max(100_000).optional(),
});

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
  try {
    const body = await req.json();
    const parsed = scanRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid scan request', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { org, visitorId, setVisitorCookie } = await resolveUsageContext(req);
    const usage = await getUsageSnapshot(org, org ? null : visitorId);

    if (!usage.allowed) {
      const response = NextResponse.json(usageLimitResponse(usage), { status: 403 });
      attachVisitorCookie(response, visitorId, setVisitorCookie);
      return response;
    }

    const report = await runAgentSecurityScan(parsed.data);
    await recordSandboxUsage({
      orgId: org?.id ?? null,
      visitorId,
      status: report.summary.critical > 0 ? 'blocked' : 'passed',
      latencyMs: report.latencyMs,
    });

    const response = NextResponse.json({
      ...report,
      quota: {
        used: usage.used + 1,
        limit: usage.limit,
        remaining: Math.max(0, usage.remaining - 1),
      },
    });
    attachVisitorCookie(response, visitorId, setVisitorCookie);
    return response;
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Scan failed',
        detail: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
