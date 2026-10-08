import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiKey, extractApiKey } from '@/lib/auth/api-key';
import { exportSignedProofBundle } from '@/lib/nexus-core/proof/assemble';
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

  const exported = exportSignedProofBundle(proof);
  return NextResponse.json({
    transaction_id,
    manifest: exported.manifest,
    proof_json: exported.proof_json,
    integrity: proof.integrity,
  });
}
