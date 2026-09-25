import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createHash, timingSafeEqual } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/webhooks/compliance — CI hook after harness export (optional HMAC validation).
 * Body: { event: "compliance.export.completed", sha256: "...", source: "harness" }
 */
export async function POST(req: NextRequest) {
  const secret = process.env.COMPLIANCE_WEBHOOK_SECRET?.trim();
  const rawBody = await req.text();

  if (secret) {
    const signature = req.headers.get('x-nexus-signature')?.trim() ?? '';
    const expected = createHash('sha256').update(`${secret}.${rawBody}`).digest('hex');
    const valid =
      signature.length === expected.length &&
      timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    if (!valid) {
      return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
    }
  }

  let payload: Record<string, unknown> = {};
  try {
    payload = rawBody ? (JSON.parse(rawBody) as Record<string, unknown>) : {};
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  return NextResponse.json(
    {
      status: 'accepted',
      message: 'Compliance webhook received. Poll GET /api/v1/compliance/evidence for latest bundle.',
      received_at: new Date().toISOString(),
      event: payload.event ?? 'compliance.export.completed',
      upstream_sha256: payload.sha256 ?? null,
    },
    { status: 202 },
  );
}
