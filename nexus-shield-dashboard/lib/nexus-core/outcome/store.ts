import type { VerificationResult } from '@/lib/nexus-core/outcome/models';

const verificationStore = new Map<string, VerificationResult>();

export function saveVerificationResult(result: VerificationResult): void {
  verificationStore.set(result.verification_id, result);
}

export function getVerificationResult(verification_id: string): VerificationResult | undefined {
  return verificationStore.get(verification_id);
}

export function clearVerificationStoreForTests(): void {
  verificationStore.clear();
}
