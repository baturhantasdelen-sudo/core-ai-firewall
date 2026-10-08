import type { TransactionIntegrityStatus } from '@/lib/nexus-core/assurance-engine/types';

export function evaluateTransactionIntegrity(
  expected: Record<string, unknown>,
  observed: Record<string, unknown>,
): TransactionIntegrityStatus {
  const expAmt = expected.refund_amount ?? expected.amount;
  const actAmt = observed.refund_amount ?? observed.amount;
  if (expAmt !== undefined && actAmt !== undefined && Number(expAmt) !== Number(actAmt)) {
    return 'MISMATCH';
  }
  const expTarget = expected.invoice_id ?? expected.target;
  const actTarget = observed.invoice_id ?? observed.target;
  if (expTarget !== undefined && actTarget !== undefined && expTarget !== actTarget) {
    return 'MISMATCH';
  }
  const st = String(observed.status ?? observed.payment_status ?? '');
  if (/pending|processing/i.test(st)) return 'PENDING';
  if (expected.transaction_id && !observed.transaction_id) return 'MISSING';
  return 'OK';
}

export function evaluateResourceIntegrity(
  expectedResourceId: string | undefined,
  observed: Record<string, unknown>,
  mutationCount?: number,
): 'OK' | 'WRONG_RESOURCE' | 'BULK_MUTATION' {
  if (mutationCount !== undefined && mutationCount > 1) return 'BULK_MUTATION';
  const observedId = String(observed.invoice_id ?? observed.resource_id ?? observed.customer_id ?? '');
  if (expectedResourceId && observedId && expectedResourceId !== observedId) {
    return 'WRONG_RESOURCE';
  }
  if (observed.records_changed !== undefined && Number(observed.records_changed) > 1) {
    return 'BULK_MUTATION';
  }
  return 'OK';
}
