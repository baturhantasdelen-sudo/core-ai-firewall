import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiKey, extractApiKey } from '@/lib/auth/api-key';
import { loadVerificationProof } from '@/lib/nexus-core/proof/verification-proof';
import { ensureAssurancePersistenceBootstrapped } from '@/lib/nexus-core/outcome/org-verify';

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

  ensureAssurancePersistenceBootstrapped();
  const { verification_id } = await ctx.params;
  const proof = await loadVerificationProof(org.id, verification_id);
  if (!proof) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(proof);
}
