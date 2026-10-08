import type { VerificationResult } from '@/lib/nexus-core/outcome/models';

const byKey = new Map<string, VerificationResult>();

export function idempotencyLookup(key: string | undefined): VerificationResult | undefined {
  if (!key) return undefined;
  return byKey.get(key);
}

export function idempotencySave(key: string | undefined, result: VerificationResult): void {
  if (!key) return;
  byKey.set(key, result);
}

export function clearIdempotencyForTests(): void {
  byKey.clear();
}

export function buildIdempotencyKey(action_id: string, key?: string): string | undefined {
  if (!key) return undefined;
  return `${action_id}:${key}`;
}
