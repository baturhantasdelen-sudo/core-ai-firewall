import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiKey, extractApiKey } from '@/lib/auth/api-key';
import { getProofByTransactionId } from '@/lib/nexus-core/proof/store';

export const runtime = 'nodejs';

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ transaction_id: string }> },
) {
  const apiKey = extractApiKey(req);
  if (!apiKey) {
    return NextResponse.json({ error: 'Unauthorized: Missing API key' }, { status: 401 });
  }
  const org = await authenticateApiKey(apiKey);
  if (!org) {
    return NextResponse.json({ error: 'Unauthorized: Invalid API key' }, { status: 401 });
  }

  const { transaction_id } = await ctx.params;
  const proof = getProofByTransactionId(transaction_id);
  if (!proof) {
    return NextResponse.json({ error: 'Proof not found for transaction' }, { status: 404 });
  }

  return NextResponse.json({
    transaction_id,
    verification_status: proof.verification_status,
    false_success_detected: proof.false_success_detected,
    claims: proof.claims,
    integrity: proof.integrity,
    evidence_summary: proof.claims.map((c) => ({
      claim: c.claim,
      source_id: c.source_id,
      authoritative_vertical: c.authoritative_vertical,
      observed_at: c.observed_at,
      match: c.match,
    })),
  });
}
