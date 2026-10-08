import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiKey, extractApiKey } from '@/lib/auth/api-key';
import { getVerificationResult } from '@/lib/nexus-core/outcome/store';

export const runtime = 'nodejs';

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ verification_id: string }> },
) {
  const apiKey = extractApiKey(req);
  if (!apiKey) {
    return NextResponse.json({ error: 'Unauthorized: Missing API key' }, { status: 401 });
  }
  const org = await authenticateApiKey(apiKey);
  if (!org) {
    return NextResponse.json({ error: 'Unauthorized: Invalid API key' }, { status: 401 });
  }

  const { verification_id } = await ctx.params;
  const result = getVerificationResult(verification_id);
  if (!result) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({
    verification_id,
    evidence: result.evidence,
    integrity: result.integrity,
  });
}
