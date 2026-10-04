import type { DeceptionUarReceipt } from '@/lib/landing/deception-demo';

const SHA256_HEX = /^sha256:[a-f0-9]{64}$/;
const SIG_PREFIX = 'sig_nexus_ed25519_';

export type VerifyPhase = 'idle' | 'hashing' | 'ed25519' | 'success' | 'failed';

export function validateDemoReceiptStructure(receipt: DeceptionUarReceipt): boolean {
  const proof = receipt.cryptographic_proof;
  const outcome = receipt.outcome_verification;
  if (!SHA256_HEX.test(proof.evidence_hash)) return false;
  if (!SHA256_HEX.test(outcome.state_before_hash)) return false;
  if (!SHA256_HEX.test(outcome.state_after_hash)) return false;
  if (!proof.signature.startsWith(SIG_PREFIX)) return false;
  if (!outcome.verifier_signature.startsWith(SIG_PREFIX)) return false;
  if (!receipt.receipt_id.startsWith('aar_')) return false;
  return true;
}

export async function runDemoVerificationAnimation(
  receipt: DeceptionUarReceipt,
  onPhase: (phase: VerifyPhase) => void,
): Promise<boolean> {
  onPhase('hashing');
  await sleep(700);
  const canonical = JSON.stringify({
    receipt_id: receipt.receipt_id,
    evidence_hash: receipt.cryptographic_proof.evidence_hash,
    state_before_hash: receipt.outcome_verification.state_before_hash,
    state_after_hash: receipt.outcome_verification.state_after_hash,
  });
  await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));

  onPhase('ed25519');
  await sleep(800);

  const ok = validateDemoReceiptStructure(receipt);
  onPhase(ok ? 'success' : 'failed');
  return ok;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
