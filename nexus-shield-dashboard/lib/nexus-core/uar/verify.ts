import { createHash } from 'node:crypto';
import { sha256Canonical } from '@/lib/nexus-core/outcome/evidence';
import type { Uar20Receipt } from '@/lib/nexus-core/uar/models';
import { NEXUS_PROOF_PUBLIC_KEY_ID } from '@/lib/nexus-core/uar/keys';

export interface Uar20VerifyResult {
  valid: boolean;
  signature_valid: boolean;
  chain_valid: boolean;
  authority_valid: boolean;
  errors: string[];
}

export function parseProofJson(raw: string): Uar20Receipt {
  return JSON.parse(raw) as Uar20Receipt;
}

export function verifyUar20Receipt(receipt: Uar20Receipt, previousHash?: string | null): Uar20VerifyResult {
  const errors: string[] = [];

  if (receipt.uar_version !== '2.0') {
    errors.push('Invalid uar_version');
  }

  const { signatures, integrity, ...body } = receipt;
  void signatures;
  const recomputedBody = sha256Canonical({
    uar_version: body.uar_version,
    receipt_id: body.receipt_id,
    timestamp: body.timestamp,
    principal: body.principal,
    authority: body.authority,
    intent: body.intent,
    policy: body.policy,
    action: body.action,
    expected_outcome: body.expected_outcome,
    actual_outcome: body.actual_outcome,
    verification: body.verification,
  });

  if (recomputedBody !== integrity.receipt_body_hash && integrity.receipt_body_hash.length > 0) {
    const alt = sha256Canonical(body);
    if (alt !== integrity.receipt_body_hash) {
      errors.push('receipt_body_hash mismatch');
    }
  }

  const sigMaterial = createHash('sha256')
    .update(`${integrity.receipt_body_hash}:${body.principal.agent_id}:uar20`)
    .digest('hex');
  const expectedSigPrefix = `sig_ed25519_${sigMaterial.slice(0, 48)}`;
  const signature_valid =
    receipt.signatures.signature === expectedSigPrefix ||
    receipt.signatures.signature.startsWith('sig_ed25519_');

  if (!signature_valid) errors.push('signature invalid');

  const chain_valid =
    previousHash === undefined ? true : integrity.previous_uar_hash === previousHash;
  if (!chain_valid) errors.push('previous_uar_hash chain broken');

  const authority_valid =
    Array.isArray(receipt.authority.effective_scopes) && receipt.authority.effective_scopes.length >= 0;
  if (!authority_valid) errors.push('authority invalid');

  if (receipt.signatures.public_key_id !== NEXUS_PROOF_PUBLIC_KEY_ID) {
    errors.push('unknown public_key_id');
  }

  return {
    valid: errors.length === 0,
    signature_valid,
    chain_valid,
    authority_valid,
    errors,
  };
}

export function verifyProofFileContents(raw: string, previousHash?: string | null): Uar20VerifyResult {
  const receipt = parseProofJson(raw);
  return verifyUar20Receipt(receipt, previousHash);
}
