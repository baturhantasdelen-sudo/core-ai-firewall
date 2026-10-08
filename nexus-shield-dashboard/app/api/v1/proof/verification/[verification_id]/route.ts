import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiKey, extractApiKey } from '@/lib/auth/api-key';
import { getVerificationResult } from '@/lib/nexus-core/outcome/store';

export const runtime = 'nodejs';

/** Real verification record — not demo Proof Center fixtures. */
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
    record_type: 'REAL',
    verification: result,
    verification_status: result.status,
    false_success_detected: result.false_success_detected,
    post_block_side_effect_detected: result.post_block_side_effect_detected ?? false,
    outcome_diff: result.diff,
    evidence_ids: result.evidence.map((e) => e.evidence_id),
    integrity: result.integrity,
  });
}
